// GET/POST /api/charts/analyses — analyses graphiques de l'utilisateur connecté.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiValidationError,
  privateCacheHeaders,
} from "@/lib/api/response";
import { chartAnalysisBodySchema } from "@/lib/charts/chart-analysis-schema";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();

  const rows = await prisma.chartAnalysis.findMany({
    where: {
      userId,
      ...(ticker ? { ticker } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      ticker: true,
      name: true,
      drawings: true,
      indicators: true,
      range: true,
      interval: true,
      compareTickers: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(
    {
      analyses: rows.map((r) => ({
        id: r.id,
        ticker: r.ticker,
        name: r.name,
        drawings: r.drawings,
        indicators: r.indicators,
        range: r.range,
        interval: r.interval,
        compareTickers: r.compareTickers,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    },
    { headers: privateCacheHeaders() }
  );
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return apiError("Authentification requise", 401);

    const body = await request.json().catch(() => null);
    const parsed = chartAnalysisBodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const data = parsed.data;
    const payload = {
      name: data.name,
      drawings: data.drawings as unknown as Prisma.InputJsonValue,
      indicators: data.indicators as unknown as Prisma.InputJsonValue,
      range: data.range,
      interval: data.interval,
      compareTickers: data.compareTickers as unknown as Prisma.InputJsonValue,
    };

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      return apiError("Session invalide — reconnectez-vous.", 401);
    }

    if (data.id) {
      const existing = await prisma.chartAnalysis.findUnique({ where: { id: data.id } });
      if (!existing || existing.userId !== userId) return apiNotFound("Analyse");
      const updated = await prisma.chartAnalysis.update({
        where: { id: data.id },
        data: {
          ...payload,
          ticker: data.ticker,
        },
      });
      return apiSuccess(
        {
          analysis: {
            id: updated.id,
            ticker: updated.ticker,
            name: updated.name,
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        { headers: privateCacheHeaders() }
      );
    }

    const created = await prisma.chartAnalysis.create({
      data: {
        userId,
        ticker: data.ticker,
        ...payload,
      },
    });

    return apiSuccess(
      {
        analysis: {
          id: created.id,
          ticker: created.ticker,
          name: created.name,
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201, headers: privateCacheHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/charts/analyses]", message);
    return apiError("Enregistrement impossible.", 500, {
      reason: message.slice(0, 300),
    });
  }
}
