import { prisma } from "../lib/prisma";

async function main() {
  for (const ticker of ["SNTS", "NEIC", "SPHC", "TTLC"]) {
    const rows = await prisma.dividend.findMany({
      where: { isCanonical: true, company: { ticker } },
      orderBy: { year: "desc" },
      take: 3,
      select: {
        year: true,
        amount: true,
        exDate: true,
        paymentDate: true,
        source: true,
      },
    });
    console.log(ticker, rows.map((r) => ({
      y: r.year,
      ex: r.exDate?.toISOString().slice(0, 10) ?? null,
      pay: r.paymentDate?.toISOString().slice(0, 10) ?? null,
      src: r.source,
    })));
  }
}

main().finally(() => prisma.$disconnect());
