// POST /api/portfolio/:portfolioId/import-statement/confirm
// Enregistre les lignes validées par l'utilisateur (fusion ou remplacement).
// Le relevé d'origine n'est pas relu : seules les valeurs corrigées arrivent ici.

import { NextRequest } from "next/server";
import { z } from "zod";
import { HoldingSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { recordPortfolioTrade } from "@/lib/api/portfolio-trades";
import {
  buildStatementTradeNote,
  consolidateImportRows,
  consolidateOtherRows,
  otherInstrumentKey,
  type ConfirmedOtherRow,
} from "@/lib/portfolio/sgi-statement/consolidate";
import { isMissingOtherHoldingsTable } from "@/lib/portfolio/other-holdings-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const bodySchema = z.object({
  mode: z.enum(["merge", "replace"]),
  statementDate: ymdSchema,
  issuer: z.string().max(80).nullable().optional(),
  rows: z
    .array(
      z.object({
        companyId: z.string().trim().min(1).max(64),
        quantity: z.number().positive().max(1_000_000_000),
        avgBuyPrice: z.number().positive().max(1_000_000_000),
        buyDate: ymdSchema,
      })
    )
    .max(200)
    .optional()
    .default([]),
  otherRows: z
    .array(
      z.object({
        kind: z.enum(["OBLIGATION", "FCP"]),
        name: z.string().trim().min(1).max(160),
        isin: z.string().trim().max(16).nullable().optional(),
        code: z.string().trim().max(32).nullable().optional(),
        manager: z.string().trim().max(120).nullable().optional(),
        quantity: z.number().positive().max(1_000_000_000),
        avgBuyPrice: z.number().positive().max(1_000_000_000),
        priceMode: z.enum(["FCFA", "PERCENT"]).optional(),
        nominal: z.number().positive().max(1_000_000_000).nullable().optional(),
        couponRate: z.number().min(0).max(100).nullable().optional(),
        maturityDate: ymdSchema,
        buyDate: ymdSchema,
        latestValue: z.number().positive().max(1_000_000_000).nullable().optional(),
      })
    )
    .max(200)
    .optional()
    .default([]),
});

function isRealYmd(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export async function POST(request: NextRequest, { params }: { params: { portfolioId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const statementDate = parsed.data.statementDate ?? null;
  if (statementDate && !isRealYmd(statementDate)) {
    return apiError("Date du relevé invalide.", 422);
  }

  const stockRows = parsed.data.rows ?? [];
  const otherInput = parsed.data.otherRows ?? [];
  if (
    stockRows.some((row) => row.buyDate && !isRealYmd(row.buyDate)) ||
    otherInput.some((row) => (row.buyDate && !isRealYmd(row.buyDate)) || (row.maturityDate && !isRealYmd(row.maturityDate)))
  ) {
    return apiError("Date d’achat invalide.", 422);
  }

  const consolidated = consolidateImportRows(stockRows);
  const otherRows = consolidateOtherRows(otherInput);
  if (consolidated.length === 0 && otherRows.length === 0) {
    return apiError("Aucune ligne exploitable : indiquez une quantité et un prix pour chaque ligne retenue.", 422);
  }

  if (consolidated.length > 0) {
    const companies = await prisma.company.findMany({
      where: { id: { in: consolidated.map((row) => row.companyId) }, exchange: "BRVM" },
      select: { id: true },
    });
    if (companies.length !== consolidated.length) {
      return apiError("Une ou plusieurs sociétés ne sont plus reconnues. Relancez l’analyse du relevé.", 422);
    }
  }

  const issuer = parsed.data.issuer?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  const note = buildStatementTradeNote(issuer, statementDate);
  const tradedAt = statementDate ? new Date(`${statementDate}T00:00:00.000Z`) : new Date();
  const mode = parsed.data.mode;

  let result: { created: number; updated: number; deleted: number; skipped: number };
  try {
    result = await prisma.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      let deleted = 0;
      let skipped = 0;

      if (mode === "replace") {
        const removed = await tx.portfolioHolding.deleteMany({ where: { portfolioId: portfolio.id } });
        deleted = removed.count;
      }

      for (const row of consolidated) {
        const rowTradedAt = row.buyDate ? new Date(`${row.buyDate}T00:00:00.000Z`) : tradedAt;
        const existing =
          mode === "replace"
            ? null
            : await tx.portfolioHolding.findUnique({
                where: {
                  uniq_holding_portfolio_company: {
                    portfolioId: portfolio.id,
                    companyId: row.companyId,
                  },
                },
              });

        if (existing) {
          const existingQty = Number(existing.quantity);
          const existingAvg = Number(existing.avgBuyPrice);
          const newQty = existingQty + row.quantity;
          const newAvg = (existingQty * existingAvg + row.quantity * row.avgBuyPrice) / newQty;
          await tx.portfolioHolding.update({
            where: { id: existing.id },
            data: {
              quantity: newQty,
              avgBuyPrice: newAvg,
              lastSide: HoldingSide.ACHAT,
              buyDate:
                existing.buyDate && existing.buyDate.getTime() <= rowTradedAt.getTime() ? existing.buyDate : rowTradedAt,
              notes: existing.notes ?? note,
            },
          });
          updated += 1;
        } else {
          await tx.portfolioHolding.create({
            data: {
              portfolioId: portfolio.id,
              companyId: row.companyId,
              quantity: row.quantity,
              avgBuyPrice: row.avgBuyPrice,
              lastSide: HoldingSide.ACHAT,
              buyDate: rowTradedAt,
              notes: note,
            },
          });
          created += 1;
        }

        await recordPortfolioTrade(tx, {
          portfolioId: portfolio.id,
          companyId: row.companyId,
          side: HoldingSide.ACHAT,
          quantity: row.quantity,
          price: row.avgBuyPrice,
          tradedAt: rowTradedAt,
          notes: note,
        });
      }

      if (mode === "replace") {
        const removedOther = await tx.portfolioOtherHolding.deleteMany({ where: { portfolioId: portfolio.id } });
        deleted += removedOther.count;
      }

      const existingOther =
        mode === "replace" || otherRows.length === 0
          ? []
          : await tx.portfolioOtherHolding.findMany({ where: { portfolioId: portfolio.id } });
      const otherByKey = new Map(existingOther.map((row) => [otherInstrumentKey(row), row]));

      for (const row of otherRows) {
        const key = otherInstrumentKey(row);
        const existing = otherByKey.get(key) ?? null;
        const sameMode = !existing || existing.priceMode === (row.priceMode ?? "FCFA");
        if (existing && !sameMode) {
          skipped += 1;
          continue;
        }
        const saved = await upsertOtherHolding(tx, portfolio.id, row, existing, note);
        otherByKey.set(key, saved);
        if (existing) updated += 1;
        else created += 1;
      }

      return { created, updated, deleted, skipped };
    },
    { timeout: 20_000 }
    );
  } catch (err) {
    if (isMissingOtherHoldingsTable(err)) {
      return apiError("La base ne suit pas encore les obligations et FCP. Appliquez la migration, puis réessayez.", 503);
    }
    throw err;
  }

  console.info("[sgi-statement] confirmé", {
    portfolioId: portfolio.id,
    mode,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    skipped: result.skipped,
  });

  return apiSuccess(
    {
      mode,
      imported: consolidated.length + otherRows.length,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      skipped: result.skipped,
    },
    { headers: privateCacheHeaders() }
  );
}

function ymdDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

async function upsertOtherHolding(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  portfolioId: string,
  row: ConfirmedOtherRow,
  existing: { id: string; quantity: unknown; avgBuyPrice: unknown; buyDate: Date | null; notes: string | null } | null,
  note: string
) {
  const buyDate = ymdDate(row.buyDate);
  const optional = {
    ...(row.isin ? { isin: row.isin } : {}),
    ...(row.code ? { code: row.code } : {}),
    ...(row.manager ? { manager: row.manager } : {}),
    ...(row.nominal != null ? { nominal: row.nominal } : {}),
    ...(row.couponRate != null ? { couponRate: row.couponRate } : {}),
    ...(row.maturityDate ? { maturityDate: ymdDate(row.maturityDate) } : {}),
    ...(row.latestValue != null ? { latestValue: row.latestValue, latestValueDate: new Date() } : {}),
  };

  if (!existing) {
    return tx.portfolioOtherHolding.create({
      data: {
        portfolioId,
        kind: row.kind,
        name: row.name,
        quantity: row.quantity,
        avgBuyPrice: row.avgBuyPrice,
        priceMode: row.priceMode ?? "FCFA",
        buyDate,
        notes: note,
        ...optional,
      },
    });
  }

  const existingQty = Number(existing.quantity);
  const existingAvg = Number(existing.avgBuyPrice);
  const newQty = existingQty + row.quantity;
  const newAvg = (existingQty * existingAvg + row.quantity * row.avgBuyPrice) / newQty;
  return tx.portfolioOtherHolding.update({
    where: { id: existing.id },
    data: {
      name: row.name,
      quantity: newQty,
      avgBuyPrice: newAvg,
      buyDate: existing.buyDate && buyDate && existing.buyDate.getTime() <= buyDate.getTime() ? existing.buyDate : (buyDate ?? existing.buyDate),
      notes: existing.notes ?? note,
      ...optional,
    },
  });
}
