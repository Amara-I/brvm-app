// PATCH / DELETE /api/portfolio/:portfolioId/other-holdings/:holdingId

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";
import { isMissingOtherHoldingsTable } from "@/lib/portfolio/other-holdings-errors";

export const dynamic = "force-dynamic";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .nullable()
  .optional();

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    isin: z.string().trim().max(16).nullable().optional(),
    code: z.string().trim().max(32).nullable().optional(),
    manager: z.string().trim().max(120).nullable().optional(),
    quantity: z.coerce.number().positive("La quantité doit être positive").optional(),
    avgBuyPrice: z.coerce.number().positive("Le prix d'achat doit être positif").optional(),
    priceMode: z.enum(["FCFA", "PERCENT"]).optional(),
    nominal: z.union([z.coerce.number().positive(), z.null()]).optional(),
    couponRate: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    maturityDate: ymd,
    buyDate: ymd,
    latestValue: z.union([z.coerce.number().positive(), z.null()]).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Aucune modification",
  });

function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function loadOwned(portfolioId: string, holdingId: string, userId: string) {
  const holding = await prisma.portfolioOtherHolding.findUnique({
    where: { id: holdingId },
    include: { portfolio: true },
  });
  if (!holding || holding.portfolioId !== portfolioId || holding.portfolio.userId !== userId) return null;
  return holding;
}

export async function PATCH(request: NextRequest, { params }: { params: { portfolioId: string; holdingId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  let holding;
  try {
    holding = await loadOwned(params.portfolioId, params.holdingId, userId);
  } catch (err) {
    if (isMissingOtherHoldingsTable(err)) {
      return apiError("La base ne suit pas encore les obligations et FCP. Appliquez la migration, puis réessayez.", 503);
    }
    throw err;
  }
  if (!holding) return apiNotFound("Position");

  const body = await request.json().catch(() => null);
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const normalized: Record<string, unknown> = { ...source };
  for (const key of ["isin", "code", "manager", "maturityDate", "buyDate", "notes"] as const) {
    if (key in source) normalized[key] = blankToNull(source[key]);
  }
  for (const key of ["nominal", "couponRate", "latestValue"] as const) {
    if (source[key] === "") normalized[key] = null;
  }
  const parsed = patchSchema.safeParse(normalized);
  if (!parsed.success) return apiValidationError(parsed.error);
  const row = parsed.data;

  const latestTouched = row.latestValue !== undefined;
  const updated = await prisma.portfolioOtherHolding.update({
    where: { id: holding.id },
    data: {
      ...(row.name !== undefined ? { name: row.name } : {}),
      ...(row.isin !== undefined ? { isin: row.isin || null } : {}),
      ...(row.code !== undefined ? { code: row.code || null } : {}),
      ...(row.manager !== undefined ? { manager: row.manager || null } : {}),
      ...(row.quantity !== undefined ? { quantity: row.quantity } : {}),
      ...(row.avgBuyPrice !== undefined ? { avgBuyPrice: row.avgBuyPrice } : {}),
      ...(row.priceMode !== undefined && holding.kind === "OBLIGATION" ? { priceMode: row.priceMode } : {}),
      ...(row.nominal !== undefined ? { nominal: row.nominal } : {}),
      ...(row.couponRate !== undefined ? { couponRate: row.couponRate } : {}),
      ...(row.maturityDate !== undefined
        ? { maturityDate: row.maturityDate ? new Date(`${row.maturityDate}T00:00:00.000Z`) : null }
        : {}),
      ...(row.buyDate !== undefined ? { buyDate: row.buyDate ? new Date(`${row.buyDate}T00:00:00.000Z`) : null } : {}),
      ...(latestTouched
        ? { latestValue: row.latestValue ?? null, latestValueDate: row.latestValue != null ? new Date() : null }
        : {}),
      ...(row.notes !== undefined ? { notes: row.notes || null } : {}),
    },
  });

  return apiSuccess({ holding: { id: updated.id, name: updated.name } });
}

export async function DELETE(_request: NextRequest, { params }: { params: { portfolioId: string; holdingId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  let holding;
  try {
    holding = await loadOwned(params.portfolioId, params.holdingId, userId);
  } catch (err) {
    if (isMissingOtherHoldingsTable(err)) {
      return apiError("La base ne suit pas encore les obligations et FCP. Appliquez la migration, puis réessayez.", 503);
    }
    throw err;
  }
  if (!holding) return apiNotFound("Position");

  await prisma.portfolioOtherHolding.delete({ where: { id: holding.id } });
  return apiSuccess({ deleted: true });
}
