// Requêtes Prisma partagées : "dernière valeur canonique" par société,
// utilisées par plusieurs API routes (liste sociétés, détail, market summary).
import { prisma } from "../prisma";

/**
 * Parmi des lignes de cours (déjà filtrées ou non), retient la plus récente
 * dont la date est ≤ `now`. Utilisé pour documenter / tester le garde-fou
 * anti-proxy futur (ex. seed 31/12 année courante).
 */
export function selectLatestPriceOnOrBefore<T extends { date: Date }>(
  rows: T[],
  now: Date = new Date()
): T | null {
  const eligible = rows.filter((r) => r.date.getTime() <= now.getTime());
  if (eligible.length === 0) return null;
  return eligible.reduce((best, row) => (row.date > best.date ? row : best));
}

/// Dernier cours de clôture CANONIQUE (post-réconciliation) de chaque société
/// d'une liste donnée. Utilise `distinct` (DISTINCT ON côté PostgreSQL) pour
/// récupérer en une seule requête la ligne la plus récente par société.
export async function getLatestCanonicalPrices(companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.priceHistory.findMany>>[number]>();
  // Exclure les proxies futurs (ex. 31/12 de l'année en cours) qui écraseraient
  // un vrai cours du jour — même garde-fou que market-spark-series / companies-full.
  const now = new Date();
  const rows = await prisma.priceHistory.findMany({
    where: { companyId: { in: companyIds }, isCanonical: true, date: { lte: now } },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    distinct: ["companyId"],
  });
  return new Map(rows.map((r) => [r.companyId, r]));
}

/// Dernier cours de clôture CANONIQUE strictement antérieur au 1er janvier
/// de `year`, par société — utilisé comme référence "début d'année" pour le
/// calcul de performance YTD du portefeuille (cf. lib/calc/portfolio-metrics.ts).
/// En l'absence de cotation quotidienne réelle (avant l'étape 6), cela
/// correspond au dernier cours de clôture de l'année précédente (31/12).
export async function getYearStartCanonicalPrices(companyIds: string[], year: number) {
  if (companyIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.priceHistory.findMany>>[number]>();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const rows = await prisma.priceHistory.findMany({
    where: { companyId: { in: companyIds }, isCanonical: true, date: { lt: yearStart } },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    distinct: ["companyId"],
  });
  return new Map(rows.map((r) => [r.companyId, r]));
}

/// Ratio financier CANONIQUE le plus récent (PER, capitalisation) par société.
export async function getLatestFinancialRatios(companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.financialRatio.findMany>>[number]>();
  const rows = await prisma.financialRatio.findMany({
    where: { companyId: { in: companyIds }, isCanonical: true },
    orderBy: [{ companyId: "asc" }, { year: "desc" }],
    distinct: ["companyId"],
  });
  return new Map(rows.map((r) => [r.companyId, r]));
}

/**
 * Dernière clôture canonique d’une société à une date donnée (ou la séance
 * précédente si ce jour n’est pas coté). Borne haute = min(asOf, maintenant)
 * pour ne jamais servir un proxy futur.
 */
export async function getCanonicalCloseOnOrBefore(companyId: string, asOfIso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfIso.trim());
  if (!match) return null;
  const asOf = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999));
  const now = new Date();
  const end = asOf.getTime() > now.getTime() ? now : asOf;
  return prisma.priceHistory.findFirst({
    where: { companyId, isCanonical: true, date: { lte: end } },
    orderBy: { date: "desc" },
  });
}
