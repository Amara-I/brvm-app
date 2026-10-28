// Étape 2 — téléchargement poli (~1 req/s) des PDF listés dans le manifeste, puis conversion
// `pdftotext -layout` (pages séparées par \f). Idempotent : les fichiers présents sont conservés.
// Usage : ts-node --transpile-only scripts/ngx/download.ts [--tickers X,Y] [--types AUDITED_FS,EARNINGS_RELEASE]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { politeFetch } from "../../lib/ngx/fundamentals/http";
import type { NgxManifestEntry } from "../../lib/ngx/fundamentals/types";
import { arg, DOCS_DIR, MANIFEST_PATH, tickerFilter } from "./stage";

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as NgxManifestEntry[];
  const only = tickerFilter();
  const types = (arg("types") ?? "AUDITED_FS").split(",");
  const todo = manifest.filter((e) => types.includes(e.docType) && (!only || only.includes(e.ticker)));
  console.log(`${todo.length} documents to fetch (types ${types.join(",")})`);
  let ok = 0, skipped = 0, failed = 0;
  for (const e of todo) {
    const dir = path.join(DOCS_DIR, e.ticker);
    fs.mkdirSync(dir, { recursive: true });
    const pdf = path.join(dir, e.file);
    const txt = pdf.replace(/\.pdf$/i, ".txt");
    try {
      if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 5_000) {
        const res = await politeFetch(e.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
        ok++;
      } else skipped++;
      if (!fs.existsSync(txt)) execFileSync("pdftotext", ["-layout", pdf, txt], { timeout: 180_000 });
    } catch (err) {
      failed++;
      console.warn(`FAIL ${e.ticker} ${e.file}: ${String(err).slice(0, 120)}`);
    }
  }
  console.log(`downloaded ${ok}, already present ${skipped}, failed ${failed}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
