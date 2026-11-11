// Étape 1 — découverte : annuaire des sociétés NGX (titres en circulation, ISIN…) + liste officielle
// des dépôts (états audités / rapports annuels) pour chaque symbole (courant + historiques).
// Usage : ts-node --transpile-only scripts/ngx/discover.ts [--tickers DANGCEM,GTCO] [--from 2016] [--to 2025]
import fs from "node:fs";
import { NGX_COMPANIES } from "../../lib/ngx/fundamentals/companies";
import { buildListUrl, buildManifestEntries, NGX_DOCLIB_BASE } from "../../lib/ngx/fundamentals/discover";
import { politeFetch } from "../../lib/ngx/fundamentals/http";
import type { NgxListItem, NgxManifestEntry } from "../../lib/ngx/fundamentals/types";
import { arg, DIRECTORY_PATH, MANIFEST_PATH, STAGED_DIR, tickerFilter } from "./stage";

async function main() {
  fs.mkdirSync(STAGED_DIR, { recursive: true });
  const from = Number(arg("from") ?? 2016);
  const to = Number(arg("to") ?? 2025);
  const only = tickerFilter();

  const dirRes = await politeFetch(`${NGX_DOCLIB_BASE}/REST/api/issuers/companydirectory`);
  const directory = (await dirRes.json()) as Array<Record<string, unknown>>;
  fs.writeFileSync(DIRECTORY_PATH, JSON.stringify(directory, null, 1));
  console.log(`company directory: ${directory.length} issuers`);

  const manifest: NgxManifestEntry[] = [];
  const failed: string[] = [];
  // Avec --tickers : on fusionne dans le manifeste existant au lieu de l'écraser.
  const writeManifest = () => {
    let out = manifest;
    if (only && fs.existsSync(MANIFEST_PATH)) {
      const prev = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as NgxManifestEntry[];
      const done = new Set(manifest.map((e) => e.ticker));
      out = [...prev.filter((e) => !only.includes(e.ticker) || !done.has(e.ticker)), ...manifest];
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, 1));
    return out.length;
  };
  for (const company of NGX_COMPANIES) {
    if (only && !only.includes(company.ticker)) continue;
    // Une erreur réseau sur une société (502 doclib fréquents) ne doit pas faire perdre tout le lot :
    // on journalise, on continue, et le manifeste est réécrit après chaque société.
    try {
      const bySymbol: Record<string, NgxListItem[]> = {};
      for (const symbol of company.symbols) {
        const res = await politeFetch(buildListUrl(symbol), { headers: { Accept: "application/json;odata=verbose" } });
        const json = (await res.json()) as { d: { results: NgxListItem[] } };
        bySymbol[symbol] = json.d.results;
      }
      const entries = buildManifestEntries(company, bySymbol, { fromYear: from, toYear: to });
      manifest.push(...entries);
      const afs = new Set(entries.filter((e) => e.docType === "AUDITED_FS").map((e) => e.guessedFiscalYear));
      console.log(`${company.ticker}: ${entries.length} docs, AFS years ${[...afs].sort().join(",")}`);
    } catch (err) {
      failed.push(company.ticker);
      console.error(`${company.ticker}: ÉCHEC découverte — ${err instanceof Error ? err.message : String(err)}`);
    }
    if (only) writeManifest();
  }
  const total = writeManifest();
  console.log(`manifest: ${total} entries → ${MANIFEST_PATH}`);
  if (failed.length > 0) console.log(`échecs (relancer avec --tickers ${failed.join(",")}) : ${failed.length}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
