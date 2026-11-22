import type { PrismaClient } from "@prisma/client";

/**
 * Clôtures canoniques NGX_OFFICIEL par séance sur [from, to], en une requête.
 * Sert à juger la complétude d'une séance par rapport à ses voisines.
 */
export async function ngxCanonicalCountsByDate(
  db: PrismaClient,
  fromIso: string,
  toIso: string
): Promise<Map<string, number>> {
  const rows = await db.priceHistory.groupBy({
    by: ["date"],
    where: {
      isCanonical: true,
      source: "NGX_OFFICIEL",
      company: { exchange: "NGX" },
      date: {
        gte: new Date(`${fromIso.slice(0, 10)}T00:00:00.000Z`),
        lte: new Date(`${toIso.slice(0, 10)}T00:00:00.000Z`),
      },
    },
    _count: { _all: true },
  });
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.date.toISOString().slice(0, 10), row._count._all);
  return out;
}
