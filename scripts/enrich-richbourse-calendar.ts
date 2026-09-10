// Enrichit les dividendes « année civile » courante depuis Richbourse (rapide).
import { prisma } from "../lib/prisma";
import { richbourseConnector } from "../lib/ingestion/connectors/richbourse_connector";
import { persistRichbourseCalendarDividends } from "../lib/ingestion/persist";

async function main() {
  const year = new Date().getUTCFullYear();
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(`→ Richbourse calendrier dividendes ${year}…`);
  const result = await richbourseConnector.fetchDividendCalendar(year);
  if (!result.ok) {
    console.error("❌", result.error);
    process.exit(1);
  }
  const persist = await persistRichbourseCalendarDividends(
    prisma,
    result.data,
    companyIdByTicker
  );
  console.log(`✔ ${result.data.length} ligne(s) · ${persist.upserted} upsert(s)`);

  const rows = await prisma.dividend.findMany({
    where: { isCanonical: true, year, company: { isActive: true } },
    select: {
      exDate: true,
      paymentDate: true,
      source: true,
      company: { select: { ticker: true } },
    },
    orderBy: { company: { ticker: "asc" } },
  });
  const dated = rows.filter((r) => r.exDate || r.paymentDate).length;
  console.log(`  Exercice ${year} : ${rows.length} canoniques · ${dated} datés`);
  for (const r of rows.filter((x) => !x.exDate && !x.paymentDate)) {
    console.log(`  N/D : ${r.company.ticker} (${r.source})`);
  }
}

main().finally(() => prisma.$disconnect());
