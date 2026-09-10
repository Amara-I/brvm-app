import { prisma } from "../lib/prisma";

async function main() {
  for (const ticker of ["SNTS", "SGBC", "NTLC", "ORAC", "NSBC"]) {
    const rows = await prisma.dividend.findMany({
      where: { company: { ticker } },
      orderBy: { year: "desc" },
      take: 4,
      select: {
        year: true,
        amount: true,
        exDate: true,
        paymentDate: true,
        source: true,
        isCanonical: true,
      },
    });
    console.log("\n" + ticker, rows);
  }
}

main().finally(() => prisma.$disconnect());
