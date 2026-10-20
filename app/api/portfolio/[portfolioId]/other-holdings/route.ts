// POST /api/portfolio/:portfolioId/other-holdings — obligation ou FCP.

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

const createSchema = z.object({
  kind: z.enum(["OBLIGATION", "FCP"]),
  name: z.string().trim().min(1, "Indiquez le nom").max(160),
  isin: z.string().trim().max(16).nullable().optional(),
  code: z.string().trim().max(32).nullable().optional(),
  manager: z.string().trim().max(120).nullable().optional(),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  avgBuyPrice: z.coerce.number().positive("Le prix d'achat doit être positif"),
  priceMode: z.enum(["FCFA", "PERCENT"]).optional(),
  nominal: z.union([z.coerce.number().positive(), z.null()]).optional(),
  couponRate: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
  maturityDate: ymd,
  buyDate: ymd,
  latestValue: z.union([z.coerce.number().positive(), z.null()]).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function POST(request: NextRequest, { params }: { params: { portfolioId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const body = await request.json().catch(() => null);
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = createSchema.safeParse({
    ...source,
    isin: blankToNull(source.isin),
    code: blankToNull(source.code),
    manager: blankToNull(source.manager),
    maturityDate: blankToNull(source.maturityDate),
    buyDate: blankToNull(source.buyDate),
    notes: blankToNull(source.notes),
    nominal: source.nominal === "" ? null : source.nominal,
    couponRate: source.couponRate === "" ? null : source.couponRate,
    latestValue: source.latestValue === "" ? null : source.latestValue,
  });
  if (!parsed.success) return apiValidationError(parsed.error);

  const row = parsed.data;
  const priceMode = row.kind === "FCP" ? "FCFA" : (row.priceMode ?? "FCFA");
  const latest = row.latestValue ?? null;

  try {
    const created = await prisma.portfolioOtherHolding.create({
      data: {
        portfolioId: portfolio.id,
        kind: row.kind,
        name: row.name,
        isin: row.isin || null,
        code: row.code || null,
        manager: row.manager || null,
        quantity: row.quantity,
        avgBuyPrice: row.avgBuyPrice,
        priceMode,
        nominal: row.nominal ?? null,
        couponRate: row.couponRate ?? null,
        maturityDate: row.maturityDate ? new Date(`${row.maturityDate}T00:00:00.000Z`) : null,
        buyDate: row.buyDate ? new Date(`${row.buyDate}T00:00:00.000Z`) : null,
        latestValue: latest,
        latestValueDate: latest != null ? new Date() : null,
        notes: row.notes || null,
      },
    });
    return apiSuccess({ holding: { id: created.id, kind: created.kind, name: created.name } }, { status: 201 });
  } catch (err) {
    if (isMissingOtherHoldingsTable(err)) {
      return apiError("La base ne suit pas encore les obligations et FCP. Appliquez la migration, puis réessayez.", 503);
    }
    throw err;
  }
}
