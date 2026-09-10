import { prisma } from "../lib/prisma";

async function main() {
  const brvmTotal = await prisma.dividend.count({ where: { source: "BRVM_OFFICIEL" } });
  const brvmCanonical = await prisma.dividend.count({
    where: { source: "BRVM_OFFICIEL", isCanonical: true },
  });
  const brvmWithDates = await prisma.dividend.count({
    where: {
      source: "BRVM_OFFICIEL",
      OR: [{ exDate: { not: null } }, { paymentDate: { not: null } }],
    },
  });
  const unmapped = await prisma.dividend.findMany({
    where: { isCanonical: true, exDate: null, paymentDate: null, source: "BRVM_OFFICIEL" },
    take: 5,
    select: { company: { select: { ticker: true } }, year: true },
  });
  console.log({ brvmTotal, brvmCanonical, brvmWithDates, unmappedBrvmCanonical: unmapped });
}

main().finally(() => prisma.$disconnect());
