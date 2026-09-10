import type { PrismaClient } from "@prisma/client";

/** Copie exDate / paymentDate sur la ligne canonique depuis toute source disponible. */
export async function syncCanonicalDividendDates(db: PrismaClient): Promise<number> {
  const rows = await db.dividend.findMany({
    where: { amount: { gt: 0 } },
    select: {
      id: true,
      companyId: true,
      year: true,
      exDate: true,
      paymentDate: true,
      isCanonical: true,
    },
  });

  type Bucket = {
    canonicalId: string | null;
    canonicalEx: Date | null;
    canonicalPay: Date | null;
    bestEx: Date | null;
    bestPay: Date | null;
  };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const key = `${row.companyId}:${row.year}`;
    const bucket = buckets.get(key) ?? {
      canonicalId: null,
      canonicalEx: null,
      canonicalPay: null,
      bestEx: null,
      bestPay: null,
    };
    if (row.exDate) bucket.bestEx = row.exDate;
    if (row.paymentDate) bucket.bestPay = row.paymentDate;
    if (row.isCanonical) {
      bucket.canonicalId = row.id;
      bucket.canonicalEx = row.exDate;
      bucket.canonicalPay = row.paymentDate;
    }
    buckets.set(key, bucket);
  }

  let updated = 0;
  for (const bucket of buckets.values()) {
    if (!bucket.canonicalId) continue;
    const exDate = bucket.canonicalEx ?? bucket.bestEx;
    const paymentDate = bucket.canonicalPay ?? bucket.bestPay;
    if (!exDate && !paymentDate) continue;
    if (bucket.canonicalEx === exDate && bucket.canonicalPay === paymentDate) continue;
    await db.dividend.update({
      where: { id: bucket.canonicalId },
      data: {
        ...(exDate && !bucket.canonicalEx ? { exDate } : {}),
        ...(paymentDate && !bucket.canonicalPay ? { paymentDate } : {}),
      },
    });
    updated++;
  }
  return updated;
}
