// ═══════════════════════════════════════════════════════════════════════════
// GET /api/research/findings — Trouvailles de l'agent de recherche IA, étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Données publiques (suggestions d'amélioration produit, pas de donnée
// personnalisée) — `cacheHeaders()` standard, consommé par `app/outils/page.tsx`.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { researchFindingsQuerySchema } from "@/lib/api/query-schemas";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = researchFindingsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { page, pageSize, category } = parsed.data;

  const where: Prisma.ResearchFindingWhereInput = category ? { category } : {};

  const [totalItems, findings] = await Promise.all([
    prisma.researchFinding.count({ where }),
    prisma.researchFinding.findMany({
      where,
      orderBy: { discoveredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return apiSuccess(
    {
      items: findings.map((f) => ({
        id: f.id,
        query: f.query,
        category: f.category,
        title: f.title,
        url: f.url,
        summary: f.summary,
        provider: f.provider,
        status: f.status,
        discoveredAt: f.discoveredAt.toISOString(),
      })),
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    },
    { headers: cacheHeaders(120) }
  );
}
