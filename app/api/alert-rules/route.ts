// GET/POST /api/alert-rules — règles (variation jour / horizon / signal / indice).

import { NextRequest } from "next/server";
import { z } from "zod";
import { AlertRuleKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiSuccess, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { clampDailyMovePct } from "@/lib/notifications/logic";
import { serializeAlertRule } from "@/lib/notifications/serialize";
import { HEADLINE_INDEX_ALERT_CODES } from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

const createSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("DAILY_MOVE"),
    ticker: z.string().trim().min(1).max(12),
    percent: z.coerce.number().positive(),
  }),
  z.object({
    kind: z.literal("HORIZON_MOVE"),
    ticker: z.string().trim().min(1).max(12),
    percent: z.coerce.number().positive(),
    horizon: z.enum(["1S", "1M"]),
  }),
  z.object({
    kind: z.literal("SIGNAL_ENTRY"),
    ticker: z.string().trim().min(1).max(12),
    signal: z.enum(["ACHAT FORT", "ACHAT"]).default("ACHAT FORT"),
    minScore: z.coerce.number().min(0).max(100).optional(),
  }),
  z.object({
    kind: z.literal("INDEX_MOVE"),
    indexCode: z.string().trim().min(2).max(40),
    percent: z.coerce.number().positive(),
  }),
]);

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? null;

  try {
    const rules = await prisma.alertRule.findMany({
      where: { userId, ...(ticker ? { ticker } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });
    return apiSuccess({ rules: rules.map(serializeAlertRule) }, { headers: privateCacheHeaders() });
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiSuccess({ rules: [] }, { headers: privateCacheHeaders() });
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const data = parsed.data;

  try {
    if (data.kind === "INDEX_MOVE") {
      const code = data.indexCode.toUpperCase();
      if (!(HEADLINE_INDEX_ALERT_CODES as readonly string[]).includes(code) && !code.startsWith("BRVM")) {
        return apiError("Indice non suivi", 422);
      }
      const created = await prisma.alertRule.create({
        data: {
          userId,
          kind: AlertRuleKind.INDEX_MOVE,
          indexCode: code,
          params: { percent: clampDailyMovePct(data.percent) },
        },
      });
      return apiSuccess({ rule: serializeAlertRule(created) }, { status: 201 });
    }

    const ticker = data.ticker.toUpperCase();
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: { id: true, ticker: true },
    });
    if (!company) return apiError(`Ticker inconnu : ${ticker}`, 404);

    const params =
      data.kind === "DAILY_MOVE"
        ? { percent: clampDailyMovePct(data.percent) }
        : data.kind === "HORIZON_MOVE"
          ? { percent: clampDailyMovePct(data.percent), horizon: data.horizon }
          : { signal: data.signal, ...(data.minScore != null ? { minScore: data.minScore } : {}) };

    const created = await prisma.alertRule.create({
      data: {
        userId,
        kind: data.kind as AlertRuleKind,
        ticker: company.ticker,
        companyId: company.id,
        params,
      },
    });
    return apiSuccess({ rule: serializeAlertRule(created) }, { status: 201 });
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiError("Base de données indisponible", 503);
    }
    throw err;
  }
}
