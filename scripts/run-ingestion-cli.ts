// ═══════════════════════════════════════════════════════════════════════════
// CLI d'exécution manuelle de l'ingestion complète — étape 6
// ═══════════════════════════════════════════════════════════════════════════
// Appelle exactement la même fonction que la route cron
// (`app/api/cron/ingest/route.ts`) : utile pour un rattrapage manuel après
// incident (site source down le jour J, cron Vercel en échec...), ou pour
// tester l'ingestion en local sans passer par `next dev` + un appel HTTP.
//
// Usage : npx ts-node scripts/run-ingestion-cli.ts
// Nécessite une DATABASE_URL réelle (PostgreSQL) dans l'environnement.
// ═══════════════════════════════════════════════════════════════════════════

import { runFullIngestion } from "../lib/ingestion/run-full-ingestion";

function line(char = "─", length = 78): string {
  return char.repeat(length);
}

async function main() {
  console.log(line("═"));
  console.log("🚀 INGESTION COMPLÈTE MULTI-SOURCE — ouestBourse (étape 6)");
  console.log(line("═"));

  const summary = await runFullIngestion();

  console.log(`\n${line()}\n📊 RÉSULTAT PAR SOURCE\n${line()}`);
  for (const s of summary.perSource) {
    const icon = s.status === "SUCCESS" ? "✅" : s.status === "PARTIAL" ? "⚠️ " : "❌";
    console.log(`  ${icon} ${s.source.padEnd(14)} statut=${s.status.padEnd(8)} indices=${s.indicesFetched} cours=${s.quotesFetched} (${s.durationMs}ms)`);
    for (const e of s.errors) console.log(`       - ${e}`);
  }

  console.log(`\n${line()}\n🔀 RÉCONCILIATION\n${line()}`);
  console.log(`  Cours canoniques persistés : ${summary.reconciledPricesCount}`);
  console.log(`  Indices canoniques persistés : ${summary.reconciledIndicesCount}`);
  console.log(`  Écarts > seuil journalisés (data_discrepancies) : ${summary.discrepanciesCount}`);
  if (summary.unknownTickers.length > 0) {
    console.log(`  ⚠ Tickers inconnus rencontrés : ${summary.unknownTickers.join(", ")}`);
  }

  console.log(`\n${line("═")}\n✅ Ingestion terminée en ${summary.durationMs}ms.\n${line("═")}`);
}

main().catch((err) => {
  console.error("❌ Erreur fatale de l'ingestion :", err);
  process.exit(1);
});
