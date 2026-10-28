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
  for (const company of NGX_COMPANIES) {
    if (only && !only.includes(company.ticker)) continue;
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
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1));
  console.log(`manifest: ${manifest.length} entries → ${MANIFEST_PATH}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
