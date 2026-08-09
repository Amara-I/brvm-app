// ═══════════════════════════════════════════════════════════════════════════
// Portefeuilles utilisateur + métriques — factorisé étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Extrait de `app/api/portfolio/route.ts` (GET, étape 7) SANS changement de
// comportement, pour pouvoir être appelé directement depuis
// `app/portefeuille/page.tsx` (Server Component) sans aller-retour HTTP vers
// sa propre API — même pattern que `getCompaniesFullDataset()` pour `/marche`.
// La route `GET /api/portfolio` appelle désormais cette même fonction (zéro
// duplication de logique, comportement HTTP inchangé — vérifié par un
// nouveau test de bout en bout, cf. AGENTS.md § Étape 10).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { getLatestCanonicalPrices, getYearStartCanonicalPrices } from "@/lib/api/latest-data";
import { computePortfolioMetrics } from "@/lib/calc/portfolio-metrics";

export async function getUserPortfoliosWithMetrics(userId: string) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { holdings: { include: { company: { include: { sector: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const allCompanyIds = [...new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.companyId)))];
  const currentYear = new Date().getUTCFullYear();
  const [prices, yearStartPrices] = await Promise.all([
    getLatestCanonicalPrices(allCompanyIds),
    getYearStartCanonicalPrices(allCompanyIds, currentYear),
  ]);

  return portfolios.map((p) => {
    const metrics = computePortfolioMetrics(
      p.holdings.map((h) => {
        const price = prices.get(h.companyId);
        const yearStartPrice = yearStartPrices.get(h.companyId);
        return {
          ticker: h.company.ticker,
          sector: h.company.sector.name,
          quantity: Number(h.quantity),
          avgBuyPrice: Number(h.avgBuyPrice),
          currentPrice: price ? Number(price.closePrice) : null,
          yearStartPrice: yearStartPrice ? Number(yearStartPrice.closePrice) : null,
        };
      })
    );
    return {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      holdings: p.holdings.map((h) => ({
        id: h.id,
        ticker: h.company.ticker,
        companyName: h.company.name,
        sector: h.company.sector.name,
        quantity: Number(h.quantity),
        avgBuyPrice: Number(h.avgBuyPrice),
        buyDate: h.buyDate?.toISOString().slice(0, 10) ?? null,
        notes: h.notes,
      })),
      metrics,
    };
  });
}

export type UserPortfoliosWithMetrics = Awaited<ReturnType<typeof getUserPortfoliosWithMetrics>>;
