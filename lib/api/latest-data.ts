// Requêtes Prisma partagées : "dernière valeur canonique" par société,
// utilisées par plusieurs API routes (liste sociétés, détail, market summary).
import { prisma } from "../prisma";

/// Dernier cours de clôture CANONIQUE (post-réconciliation) de chaque société
/// d'une liste donnée. Utilise `distinct` (DISTINCT ON côté PostgreSQL) pour
/// récupérer en une seule requête la ligne la plus récente par société.
export async function getLatestCanonicalPrices(companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.priceHistory.findMany>>[number]>();
  const rows = await prisma.priceHistory.findMany({
    where: { companyId: { in: companyIds }, isCanonical: true },
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
