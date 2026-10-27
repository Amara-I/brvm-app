// ═══════════════════════════════════════════════════════════════════════════
// GET /api/companies/:ticker/projections — Projections de cours, étape 5
// ═══════════════════════════════════════════════════════════════════════════
// Port de `projectPrices()` (reference/BRVM_Dashboard.jsx), branché sur les
// cours CANONIQUES en base plutôt que sur COMPANIES_FULL — cf.
// lib/calc/project-prices.ts pour le détail de la formule (régression
// linéaire + scénarios optimiste/pessimiste ±15%, inchangée).
//
// Query params (cf. lib/api/query-schemas.ts) :
//   years  (1-10, défaut 5) — horizon de projection, comme les boutons
//   "3/5/7/10 ans" de l'onglet "Projection future" du JSX d'origine.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiNotFound, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { projectionsQuerySchema } from "@/lib/api/query-schemas";
import { projectPrices } from "@/lib/calc/project-prices";
import { priceDivisor } from "@/lib/corporate-actions/adjust";
import { actionsForTicker } from "@/lib/corporate-actions/load";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const parsed = projectionsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);

  const company = await prisma.company.findFirst({ where: { ticker, exchange: "BRVM" } });
  if (!company) return apiNotFound(`Société "${ticker}"`);

  const priceHistory = await prisma.priceHistory.findMany({
    where: { companyId: company.id, isCanonical: true },
    orderBy: { date: "asc" },
    select: { date: true, closePrice: true },
  });

  // Comme dans le JSX (`validPrices.length < 2 → []`) : pas assez d'historique
  // pour une régression → tableau vide, pas une erreur 4xx.
  if (priceHistory.length < 2) {
    return apiSuccess({ ticker, baseYear: null, projections: [] }, { headers: cacheHeaders(60) });
  }

  const actions = await actionsForTicker(ticker).catch(() => []);
  const historicalPrices = priceHistory.map((p) => ({
    year: p.date.getUTCFullYear(),
    price: Number(p.closePrice) / priceDivisor(actions, p.date.toISOString().slice(0, 10)),
  }));
  const baseYear = historicalPrices[historicalPrices.length - 1].year;
  const projections = projectPrices(historicalPrices, { futureYears: parsed.data.years, baseYear });

  return apiSuccess({ ticker, baseYear, projections }, { headers: cacheHeaders(60) });
}
