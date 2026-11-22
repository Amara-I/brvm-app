// GET/POST/DELETE /api/watchlist — liste de suivi (compte connecté).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  privateCacheHeaders,
} from "@/lib/api/response";
import { watchlistIsFull, watchlistTickerSchema } from "@/lib/watchlist/watchlist";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const rows = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { ticker: true },
  });
  return apiSuccess({ tickers: rows.map((r: { ticker: string }) => r.ticker) }, { headers: privateCacheHeaders() });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const parsed = watchlistTickerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { ticker } = parsed.data;

  // Comme pour les alertes : le ticker est unique toutes places confondues
  // (BRVM ou NGX) ; les indices ne sont pas des sociétés.
  const company = await prisma.company.findFirst({
    where: { ticker, exchange: { in: ["BRVM", "NGX"] } },
    select: { id: true, ticker: true },
  });
  if (!company) return apiError(`Ticker inconnu : ${ticker}`, 404);

  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_companyId: { userId, companyId: company.id } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.watchlistItem.count({ where: { userId } });
    if (watchlistIsFull(count)) return apiError("Liste de suivi pleine", 409);
    // upsert : deux clics simultanés ne créent pas de doublon.
    await prisma.watchlistItem.upsert({
      where: { userId_companyId: { userId, companyId: company.id } },
      create: { userId, companyId: company.id, ticker: company.ticker },
      update: {},
    });
  }
  return apiSuccess({ ticker: company.ticker, watched: true }, { headers: privateCacheHeaders() });
}

export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const parsed = watchlistTickerSchema.safeParse({
    ticker: request.nextUrl.searchParams.get("ticker") ?? "",
  });
  if (!parsed.success) return apiValidationError(parsed.error);

  // Idempotent : retirer une société absente de la liste n'est pas une erreur.
  await prisma.watchlistItem.deleteMany({ where: { userId, ticker: parsed.data.ticker } });
  return apiSuccess({ ticker: parsed.data.ticker, watched: false }, { headers: privateCacheHeaders() });
}
