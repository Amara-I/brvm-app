import { prisma } from "@/lib/prisma";

export interface EnrichedDividendRow {
  year: number;
  amount: number;
  exDate: string | null;
  paymentDate: string | null;
  source: string;
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function mapSource(source: string): string {
  switch (source) {
    case "BRVM_OFFICIEL":
      return "BRVM officiel";
    case "SIKAFINANCE":
      return "Sikafinance";
    case "MANUEL":
      return "Saisie manuelle";
    default:
      return source;
  }
}

/** Fusionne montant canonique + dates ex/paiement de toutes les sources pour une société. */
export async function loadEnrichedDividendsForCompany(
  companyId: string
): Promise<EnrichedDividendRow[]> {
  const rows = await prisma.dividend.findMany({
    where: { companyId, amount: { gt: 0 } },
    select: {
      year: true,
      amount: true,
      exDate: true,
      paymentDate: true,
      source: true,
      isCanonical: true,
    },
    orderBy: [{ year: "desc" }, { isCanonical: "desc" }],
  });

  const byYear = new Map<number, EnrichedDividendRow>();

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const existing = byYear.get(row.year);
    const exDate = toIso(row.exDate);
    const paymentDate = toIso(row.paymentDate);

    if (!existing) {
      if (!row.isCanonical) continue;
      byYear.set(row.year, {
        year: row.year,
        amount,
        exDate,
        paymentDate,
        source: mapSource(row.source),
      });
      continue;
    }

    if (!existing.exDate && exDate) existing.exDate = exDate;
    if (!existing.paymentDate && paymentDate) existing.paymentDate = paymentDate;
    if (row.isCanonical) {
      existing.amount = amount;
      existing.source = mapSource(row.source);
    }
  }

  return [...byYear.values()].sort((a, b) => b.year - a.year);
}
