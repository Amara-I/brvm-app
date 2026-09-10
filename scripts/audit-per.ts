// Audit PER canoniques pour toutes les sociétés actives.
import { prisma } from "../lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });

  const ratios = await prisma.financialRatio.findMany({
    where: { isCanonical: true },
    select: { companyId: true, year: true, per: true, mktCap: true, source: true },
    orderBy: [{ companyId: "asc" }, { year: "desc" }],
  });

  const latestByCompany = new Map<string, (typeof ratios)[0]>();
  for (const r of ratios) {
    if (!latestByCompany.has(r.companyId)) latestByCompany.set(r.companyId, r);
  }

  const missing: string[] = [];
  const invalid: Array<{ ticker: string; per: number; source: string; year: number }> = [];
  const ok: Array<{ ticker: string; per: number; source: string; year: number }> = [];

  for (const c of companies) {
    const r = latestByCompany.get(c.id);
    const per = r?.per != null ? Number(r.per) : null;
    if (!r || per === null || !Number.isFinite(per) || per <= 0) {
      if (per != null && per <= 0) invalid.push({ ticker: c.ticker, per, source: r!.source, year: r!.year });
      else missing.push(c.ticker);
    } else {
      ok.push({ ticker: c.ticker, per, source: r.source, year: r.year });
    }
  }

  console.log(`Sociétés actives : ${companies.length}`);
  console.log(`PER OK : ${ok.length}`);
  console.log(`PER manquant : ${missing.length}${missing.length ? ` → ${missing.join(", ")}` : ""}`);
  console.log(
    `PER invalide (≤0) : ${invalid.length}${invalid.length ? ` → ${invalid.map((x) => `${x.ticker}=${x.per}`).join(", ")}` : ""}`
  );
  if (ok.length) {
    console.log("\n--- Détail ---");
    for (const x of ok) console.log(`  ${x.ticker}\t${x.per}\t${x.source}\t${x.year}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
