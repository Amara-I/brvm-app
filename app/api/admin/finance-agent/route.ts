import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { monthWindow, spentCents, MONTHLY_LIMIT_CENTS, costEnvelope } from "@/lib/finance-agent/budget";
import { AGENT_PROVIDER } from "@/lib/finance-agent/run";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(); if (!auth.ok) return apiError("Accès administrateur requis", auth.status);
  const raw = Number(request.nextUrl.searchParams.get("page") ?? 1); const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 10000 ? raw : 1;
  const { start, end } = monthWindow(new Date());
  const [reservations, proposals, total] = await Promise.all([
    prisma.ingestionLog.findMany({ where: { source: "MANUEL", runAt: { gte: start, lt: end } }, select: { errors: true } }),
    prisma.researchFinding.findMany({ where: { provider: AGENT_PROVIDER }, orderBy: { discoveredAt: "desc" }, skip: (page - 1) * 30, take: 30 }),
    prisma.researchFinding.count({ where: { provider: AGENT_PROVIDER } }),
  ]);
  return apiSuccess({ monthlyLimitEur: MONTHLY_LIMIT_CENTS / 100, reservedEur: spentCents(reservations) / 100,
    priceEnvelopeValid: !!costEnvelope(), enabled: process.env.FINANCE_AGENT_ENABLED === "true", proposals,
    pagination: { page, pageSize: 30, total } }, { headers: privateCacheHeaders() });
}
