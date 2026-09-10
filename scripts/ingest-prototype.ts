// ═══════════════════════════════════════════════════════════════════════════
// Prototype d'ingestion multi-source — étape 3 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Objectif (cf. brief) : valider l'approche de bout en bout AVANT
// industrialisation, en se limitant volontairement à :
//   - les indices du jour (BRVM Composite, BRVM 30, ...)
//   - le cours de 2-3 tickers test (SNTS, SGBC, ORAC — déjà seedés en base,
//     cf. prisma/seed-data/companies-full.ts)
//
// Ce script N'ÉCRIT PAS en base : il imprime le résultat de chaque
// connecteur, applique la réconciliation (lib/ingestion/reconciliation.ts)
// et affiche la valeur retenue + les écarts détectés. La persistance dans
// `price_history` / `market_index_values` / `data_discrepancies` /
// `ingestion_logs` est prévue pour l'étape 6 (cron d'industrialisation),
// une fois l'approche validée manuellement via ce prototype.
//
// Usage : npx ts-node scripts/ingest-prototype.ts
// ═══════════════════════════════════════════════════════════════════════════

import { brvmConnector } from "../lib/ingestion/connectors/brvm_connector";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import { richbourseConnector } from "../lib/ingestion/connectors/richbourse_connector";
import { reconcilePriceBatch, reconcileIndexQuotes } from "../lib/ingestion/reconciliation";
import type { MarketDataConnector, RawIndexQuote, RawPriceQuote } from "../lib/ingestion/types";

/// Tickers de test — repris du comparatif par défaut du JSX d'origine
/// (`compSelected: ["SNTS","CBIBF","SGBC"]`), légèrement ajusté pour couvrir
/// 3 pays différents (Sénégal, Côte d'Ivoire) déjà seedés en base.
const TEST_TICKERS = ["SNTS", "SGBC", "ORAC"];

const CONNECTORS: MarketDataConnector[] = [brvmConnector, sikafinanceConnector, richbourseConnector];

function line(char = "─", length = 78): string {
  return char.repeat(length);
}

async function main() {
  console.log(line("═"));
  console.log("🌍 PROTOTYPE D'INGESTION MULTI-SOURCE — OuestBourse (étape 3)");
  console.log(`   Tickers test : ${TEST_TICKERS.join(", ")}`);
  console.log(line("═"));

  const allIndexQuotes: RawIndexQuote[] = [];
  const allPriceQuotes: RawPriceQuote[] = [];

  for (const connector of CONNECTORS) {
    console.log(`\n${line()}\n📡 Source : ${connector.source}\n${line()}`);

    const indicesResult = await connector.fetchIndices();
    if (indicesResult.ok) {
      console.log(`  ✔ Indices récupérés : ${indicesResult.data.length}`);
      for (const idx of indicesResult.data.slice(0, 6)) {
        console.log(`     - ${idx.code.padEnd(28)} ${idx.label.padEnd(30)} ${String(idx.value).padStart(10)}  (${idx.changePercent ?? "N/D"}%)`);
      }
      if (indicesResult.data.length > 6) console.log(`     ... et ${indicesResult.data.length - 6} de plus`);
      allIndexQuotes.push(...indicesResult.data);
    } else {
      console.log(`  ✘ Échec indices : ${indicesResult.error}`);
    }

    const quotesResult = await connector.fetchQuotes(TEST_TICKERS);
    if (quotesResult.ok) {
      console.log(`  ✔ Cours récupérés : ${quotesResult.data.length}/${TEST_TICKERS.length} tickers`);
      for (const q of quotesResult.data) {
        console.log(`     - ${q.ticker.padEnd(8)} ${String(q.closePrice).padStart(10)} FCFA  (volume: ${q.volume ?? "N/D"})`);
      }
      const missing = TEST_TICKERS.filter((t) => !quotesResult.data.some((q) => q.ticker === t));
      if (missing.length > 0) console.log(`     ⚠ Non disponibles sur cette source : ${missing.join(", ")}`);
      allPriceQuotes.push(...quotesResult.data);
    } else {
      console.log(`  ✘ Échec cours : ${quotesResult.error}`);
    }
  }

  // ── Réconciliation des cours ────────────────────────────────────────────
  console.log(`\n${line("═")}\n🔀 RÉCONCILIATION — Cours (priorité BRVM_OFFICIEL > SIKAFINANCE > RICHBOURSE)\n${line("═")}`);
  const { reconciled, discrepancies } = reconcilePriceBatch(allPriceQuotes);
  for (const ticker of TEST_TICKERS) {
    const r = reconciled.find((x) => x.ticker === ticker);
    if (!r) {
      console.log(`  ${ticker.padEnd(8)} → N/D (aucune source n'a retourné de cours)`);
      continue;
    }
    const sourcesStr = r.candidates.map((c) => `${c.source}=${c.closePrice}`).join(", ");
    console.log(`  ${ticker.padEnd(8)} → ${String(r.closePrice).padStart(8)} FCFA  [retenu: ${r.resolvedSource}]   (${sourcesStr})`);
  }

  if (discrepancies.length === 0) {
    console.log(`\n  ✅ Aucun écart > 2% détecté entre les sources disponibles.`);
  } else {
    console.log(`\n  ⚠ ${discrepancies.length} écart(s) > 2% détecté(s) — à journaliser dans data_discrepancies :`);
    for (const d of discrepancies) {
      console.log(`     - ${d.ticker} (${d.date}) : BRVM=${d.brvmValue ?? "N/D"} Sika=${d.sikaValue ?? "N/D"} Rich=${d.richValue ?? "N/D"} → écart max ${d.deltaPercent}%`);
    }
  }

  // ── Réconciliation des indices (BRVM Composite & BRVM 30, communs aux 3) ─
  console.log(`\n${line("═")}\n🔀 RÉCONCILIATION — Indices\n${line("═")}`);
  for (const code of ["BRVM_COMPOSITE", "BRVM_30"]) {
    const dates = [...new Set(allIndexQuotes.filter((q) => q.code === code).map((q) => q.date))];
    for (const date of dates) {
      const { reconciled: r, deltaPercent } = reconcileIndexQuotes(code, date, allIndexQuotes);
      if (!r) continue;
      const sourcesStr = r.candidates.map((c) => `${c.source}=${c.value}`).join(", ");
      console.log(`  ${code.padEnd(16)} (${date}) → ${r.value}  [retenu: ${r.resolvedSource}]   (${sourcesStr})   écart max: ${deltaPercent}%`);
    }
  }

  console.log(`\n${line("═")}\n✅ Prototype terminé. Aucune écriture en base (cf. commentaire d'en-tête).\n${line("═")}`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale du prototype :", err);
  process.exit(1);
});
