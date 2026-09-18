// Actualise documents BRVM (catalogue OuestBourse) + comptes extraits des PDF.
// Usage :
//   npm run docs:refresh
//   npx ts-node scripts/refresh-documents.ts SNTS SGBC
//
// Source : OuestBourse Supabase (`brvm_documents`, `brvm_financials_annual`)
// — URLs PDF brvm.org, jamais de fichiers inventés.
// Sikafinance /docs/* est interdit par robots.txt.

import { prisma } from "../lib/prisma";
import { runDocumentRefresh } from "../lib/ingestion/run-document-refresh";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase()).filter(Boolean);
  console.log("→ Actualisation documents / résultats (BRVM via OuestBourse)…");

  const summary = await runDocumentRefresh(
    {
      tickers: only.length ? only : undefined,
      logger: (msg) => console.log(msg),
    },
    prisma
  );

  if (summary.skipped) {
    console.warn(`⚠ Ignoré : ${summary.skipReason}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✔ ${summary.tickersOk}/${summary.tickersAttempted} société(s)` +
      ` · docs ${summary.documentsUpserted}` +
      ` · publications de résultats ${summary.resultsDocuments}` +
      ` · fondamentaux ${summary.fundamentalsUpserted}` +
      ` · ${summary.durationMs} ms` +
      (summary.incomplete ? ` · incomplet → ${summary.nextTicker}` : "")
  );
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
