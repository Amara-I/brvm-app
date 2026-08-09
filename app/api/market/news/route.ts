// ═══════════════════════════════════════════════════════════════════════════
// GET /api/market/news — Actualités de marché agrégées (pagination)
// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 du plan de migration.
// ⚠️ Table `news_articles` non encore alimentée par un connecteur dédié —
// l'ingestion des actualités (Sikafinance en particulier, cf. AGENTS.md)
// sera traitée avec le cron d'industrialisation (étape 6). Cette route est
// néanmoins fonctionnelle dès maintenant et retournera `items: []` jusque-là.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { newsListQuerySchema } from "@/lib/api/query-schemas";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = newsListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { page, pageSize, ticker } = parsed.data;

  const where: Prisma.NewsArticleWhereInput = ticker ? { company: { ticker } } : {};

  const [totalItems, articles] = await Promise.all([
    prisma.newsArticle.count({ where }),
    prisma.newsArticle.findMany({
      where,
      include: { company: { select: { ticker: true, name: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return apiSuccess(
    {
      items: articles.map((a) => ({
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        url: a.url,
        sourceName: a.sourceName,
        imageUrl: a.imageUrl,
        publishedAt: a.publishedAt.toISOString(),
        company: a.company ? { ticker: a.company.ticker, name: a.company.name } : null,
      })),
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    },
    { headers: cacheHeaders(120) }
  );
}
