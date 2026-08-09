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
import { getUserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const data = await getUserPortfoliosWithMetrics(userId);

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
