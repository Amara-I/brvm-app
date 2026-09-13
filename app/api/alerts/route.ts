// GET/POST /api/alerts — alertes de seuil de cours (compte connecté).

import { NextRequest } from "next/server";
import { z } from "zod";
import { PriceAlertDirection, PriceAlertStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api/response";
import { privateCacheHeaders } from "@/lib/api/response";
import { evaluateActivePriceAlerts } from "@/lib/alerts/evaluate-price-alerts";
import { notifyFiredPriceAlerts } from "@/lib/notifications/evaluate-all";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  ticker: z.string().trim().min(1).max(12),
  direction: z.enum(["ABOVE", "BELOW"]),
  targetPrice: z.coerce.number().positive("Le seuil doit être positif"),
  note: z.string().trim().max(200).optional().nullable(),
});

function serializeAlert(a: {
  id: string;
  ticker: string;
  direction: PriceAlertDirection;
  targetPrice: { toString(): string } | number;
  note: string | null;
  status: PriceAlertStatus;
  triggeredAt: Date | null;
  triggerPrice: { toString(): string } | number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    ticker: a.ticker,
    direction: a.direction,
    targetPrice: Number(a.targetPrice),
    note: a.note,
    status: a.status,
    triggeredAt: a.triggeredAt?.toISOString() ?? null,
    triggerPrice: a.triggerPrice != null ? Number(a.triggerPrice) : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? null;
  // Réévalue avant de lister (cours peut avoir bougé depuis le dernier cron).
  const evalResult = await evaluateActivePriceAlerts(ticker ? { tickers: [ticker] } : undefined);
  await notifyFiredPriceAlerts(evalResult.fired).catch(() => undefined);

  const alerts = await prisma.priceAlert.findMany({
    where: {
      userId,
      ...(ticker ? { ticker } : {}),
      status: { in: [PriceAlertStatus.ACTIVE, PriceAlertStatus.TRIGGERED] },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 50,
  });

  return apiSuccess(
    { alerts: alerts.map(serializeAlert) },
    { headers: privateCacheHeaders() }
  );
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const ticker = parsed.data.ticker.toUpperCase();
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { id: true, ticker: true },
  });
  if (!company) return apiError(`Ticker inconnu : ${ticker}`, 404);

  const created = await prisma.priceAlert.create({
    data: {
      userId,
      companyId: company.id,
      ticker: company.ticker,
      direction: parsed.data.direction as PriceAlertDirection,
      targetPrice: parsed.data.targetPrice,
      note: parsed.data.note?.trim() || null,
      status: PriceAlertStatus.ACTIVE,
    },
  });

  // Si le seuil est déjà atteint au moment de la création, déclencher tout de suite.
  const evalResult = await evaluateActivePriceAlerts({ tickers: [company.ticker] });
  await notifyFiredPriceAlerts(evalResult.fired).catch(() => undefined);
  const fresh = await prisma.priceAlert.findUnique({ where: { id: created.id } });

  return apiSuccess({ alert: serializeAlert(fresh ?? created) }, { status: 201 });
}
