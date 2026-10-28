// Dividendes (étape 3) — communiqués officiels NGX (avis de dividende, fermeture du registre, convocations d'AGM,
// communiqués de résultats annuels), en complément des états financiers audités.
//   discover  : liste XFinancial_News de chaque symbole (mis en cache) -> staged/disclosures.json
//   download  : PDF vers docs/<TICKER>/notices/ (~1 req/s) + pdftotext
//   extract   : texte -> staged/dividend_notices.json (DPS, type, exercice, dates)
// Usage : ts-node --transpile-only scripts/ngx/disclosures.ts <discover|download|extract|all> [--tickers X,Y] [--since 2016-01-01]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NGX_COMPANIES } from "../../lib/ngx/fundamentals/companies";
import { buildListUrl } from "../../lib/ngx/fundamentals/discover";
import { classifyDisclosure, type DisclosureKind } from "../../lib/ngx/fundamentals/disclosures";
import { parseDividendNotice, type DividendNotice } from "../../lib/ngx/fundamentals/notices";
import { politeFetch } from "../../lib/ngx/fundamentals/http";
import type { NgxListItem } from "../../lib/ngx/fundamentals/types";
import { arg, DOCS_DIR, STAGED_DIR, tickerFilter } from "./stage";

const RAW_PATH = path.join(STAGED_DIR, "disclosures_raw.json");
export const DISCLOSURES_PATH = path.join(STAGED_DIR, "disclosures.json");
export const NOTICES_PATH = path.join(STAGED_DIR, "dividend_notices.json");

interface DisclosureEntry {
  ticker: string;
  filedSymbol: string;
  kind: DisclosureKind;
  createdAt: string;
  title: string;
  url: string;
  file: string;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 150);

async function listJson(symbol: string): Promise<NgxListItem[]> {
  for (let a = 0; a < 4; a++) {
    const res = await politeFetch(buildListUrl(symbol, 2000), { headers: { Accept: "application/json;odata=verbose" } });
    const t = await res.text();
    if (t.trimStart().startsWith("{")) return JSON.parse(t).d.results as NgxListItem[];
    console.warn(`non-JSON for ${symbol} (HTTP ${res.status}), retry ${a + 1}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`list failed: ${symbol}`);
}

async function discover() {
  const only = tickerFilter();
  const since = arg("since") ?? "2016-01-01";
  fs.mkdirSync(STAGED_DIR, { recursive: true });
  const cache: Record<string, NgxListItem[]> = fs.existsSync(RAW_PATH) ? JSON.parse(fs.readFileSync(RAW_PATH, "utf8")) : {};
  const out: DisclosureEntry[] = [];
  for (const c of NGX_COMPANIES) {
    if (only && !only.includes(c.ticker)) continue;
    for (const s of c.symbols) {
      if (!cache[s] || process.argv.includes("--refresh")) cache[s] = await listJson(s);
      for (const it of cache[s]) {
        const kind = classifyDisclosure(it);
        if (!kind || it.Created < since) continue;
        const url = it.URL.Url.replace(/^http:/, "https:");
        out.push({ ticker: c.ticker, filedSymbol: s, kind, createdAt: it.Created, title: it.URL.Description ?? "", url, file: safe(`${it.Created.slice(0, 10)}_${path.basename(decodeURIComponent(url))}`) });
      }
    }
  }
  fs.writeFileSync(RAW_PATH, JSON.stringify(cache));
  const seen = new Set<string>();
  const uniq = out.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true))).sort((a, b) => a.ticker.localeCompare(b.ticker) || a.createdAt.localeCompare(b.createdAt));
  fs.writeFileSync(DISCLOSURES_PATH, JSON.stringify(uniq, null, 1));
  const by: Record<string, number> = {};
  for (const e of uniq) by[e.kind] = (by[e.kind] ?? 0) + 1;
  console.log(`${uniq.length} disclosures`, by);
}

async function download() {
  const only = tickerFilter();
  const list = JSON.parse(fs.readFileSync(DISCLOSURES_PATH, "utf8")) as DisclosureEntry[];
  const todo = list.filter((e) => !only || only.includes(e.ticker));
  let ok = 0, have = 0, failed = 0;
  for (const e of todo) {
    const dir = path.join(DOCS_DIR, e.ticker, "notices");
    fs.mkdirSync(dir, { recursive: true });
    const pdf = path.join(dir, e.file.endsWith(".pdf") ? e.file : `${e.file}.pdf`);
    const txt = pdf.replace(/\.pdf$/i, ".txt");
    try {
      if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 1_000) {
        const res = await politeFetch(e.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
        ok++;
      } else have++;
      if (!fs.existsSync(txt)) execFileSync("pdftotext", ["-layout", pdf, txt], { timeout: 120_000 });
    } catch (err) {
      failed++;
      console.warn(`FAIL ${e.ticker} ${e.file}: ${String(err).slice(0, 100)}`);
    }
  }
  console.log(`downloaded ${ok}, present ${have}, failed ${failed}`);
}

function extract() {
  const only = tickerFilter();
  const list = JSON.parse(fs.readFileSync(DISCLOSURES_PATH, "utf8")) as DisclosureEntry[];
  const notices: DividendNotice[] = [];
  let noText = 0, empty = 0;
  for (const e of list) {
    if (only && !only.includes(e.ticker)) continue;
    const pdf = path.join(DOCS_DIR, e.ticker, "notices", e.file.endsWith(".pdf") ? e.file : `${e.file}.pdf`);
    const txt = pdf.replace(/\.pdf$/i, ".txt");
    if (!fs.existsSync(txt)) { noText++; continue; }
    const text = fs.readFileSync(txt, "utf8");
    const found = parseDividendNotice(text, { createdAt: e.createdAt, title: e.title, kind: e.kind });
    if (!found.length) { empty++; continue; }
    for (const n of found) notices.push({ ...n, ticker: e.ticker, file: path.relative(DOCS_DIR, pdf), url: e.url, title: e.title, createdAt: e.createdAt });
  }
  fs.writeFileSync(NOTICES_PATH, JSON.stringify(notices, null, 1));
  console.log(`${notices.length} dividend facts from ${list.length} disclosures (no text ${noText}, no dividend found ${empty})`);
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === "discover" || cmd === "all") await discover();
  if (cmd === "download" || cmd === "all") await download();
  if (cmd === "extract" || cmd === "all") extract();
  if (!["discover", "download", "extract", "all"].includes(cmd ?? "")) console.log("usage: disclosures.ts <discover|download|extract|all>");
})().catch((e) => { console.error(e); process.exit(1); });
