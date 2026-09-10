import { prisma } from "../lib/prisma";

async function main() {
  const cos = await prisma.company.findMany({
    where: { isActive: true },
    select: { ticker: true, isin: true, description: true },
    orderBy: { ticker: "asc" },
  });
  console.log(
    JSON.stringify(
      {
        total: cos.length,
        missDesc: cos.filter((c) => !c.description).map((c) => c.ticker),
        missIsin: cos.filter((c) => !c.isin).map((c) => c.ticker),
        withDesc: cos.filter((c) => !!c.description).length,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
