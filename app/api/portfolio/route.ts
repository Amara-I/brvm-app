// ═══════════════════════════════════════════════════════════════════════════
// GET/POST /api/portfolio — Portefeuille(s) de l'utilisateur connecté, étape 7
// ═══════════════════════════════════════════════════════════════════════════
// GET  : liste tous les portefeuilles de l'utilisateur avec leurs métriques
//        calculées à la volée (valeur totale, plus/moins-value, répartition
//        sectorielle, performance YTD — cf. lib/calc/portfolio-metrics.ts),
//        façon module "Portefeuille" de Ouestbourse.
// POST : crée un nouveau portefeuille (`{ name? }`), ou renomme un
//        portefeuille existant si `{ portfolioId, name }` est fourni (cf.
//        brief : "créer/mettre à jour un portefeuille utilisateur"). La
//        gestion des POSITIONS (ajout/retrait) se fait via
//        `/api/portfolio/:portfolioId/holdings`.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { getLatestCanonicalPrices, getYearStartCanonicalPrices } from "@/lib/api/latest-data";
import { computePortfolioMetrics } from "@/lib/calc/portfolio-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

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

  const data = portfolios.map((p) => {
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

  // ⚠️ Données personnalisées par utilisateur : `private` (jamais `public`),
  // cf. lib/api/response.ts — un cache partagé (CDN) ne doit jamais resservir
  // le portefeuille d'un utilisateur à un autre.
  return apiSuccess({ portfolios: data }, { headers: privateCacheHeaders() });
}

const upsertPortfolioSchema = z.object({
  portfolioId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const body = await request.json().catch(() => ({}));
  const parsed = upsertPortfolioSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (parsed.data.portfolioId) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: parsed.data.portfolioId } });
    if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

    const updated = await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { name: parsed.data.name ?? portfolio.name },
    });
    return apiSuccess({ portfolio: { id: updated.id, name: updated.name } });
  }

  const created = await prisma.portfolio.create({
    data: { userId, name: parsed.data.name ?? "Mon portefeuille" },
  });
  return apiSuccess({ portfolio: { id: created.id, name: created.name } }, { status: 201 });
}
