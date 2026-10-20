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
import { buildStatementTradeNote, consolidateImportRows } from "@/lib/portfolio/sgi-statement/consolidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  mode: z.enum(["merge", "replace"]),
  statementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  issuer: z.string().max(80).nullable().optional(),
  rows: z
    .array(
      z.object({
        companyId: z.string().trim().min(1).max(64),
        quantity: z.number().positive().max(1_000_000_000),
        avgBuyPrice: z.number().positive().max(1_000_000_000),
      })
    )
    .min(1)
    .max(200),
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

  const consolidated = consolidateImportRows(parsed.data.rows);
  if (consolidated.length === 0) {
    return apiError("Aucune ligne exploitable : indiquez une quantité et un PRU pour chaque société retenue.", 422);
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: consolidated.map((row) => row.companyId) } },
    select: { id: true },
  });
  if (companies.length !== consolidated.length) {
    return apiError("Une ou plusieurs sociétés ne sont plus reconnues. Relancez l’analyse du relevé.", 422);
  }

  const issuer = parsed.data.issuer?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  const note = buildStatementTradeNote(issuer, statementDate);
  const tradedAt = statementDate ? new Date(`${statementDate}T00:00:00.000Z`) : new Date();
  const mode = parsed.data.mode;

  const result = await prisma.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      let deleted = 0;

      if (mode === "replace") {
        const removed = await tx.portfolioHolding.deleteMany({ where: { portfolioId: portfolio.id } });
        deleted = removed.count;
      }

      for (const row of consolidated) {
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
              buyDate: tradedAt,
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
              buyDate: tradedAt,
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
          tradedAt,
          notes: note,
        });
      }

      return { created, updated, deleted };
    },
    { timeout: 20_000 }
  );

  console.info("[sgi-statement] confirmé", {
    portfolioId: portfolio.id,
    mode,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
  });

  return apiSuccess(
    {
      mode,
      imported: consolidated.length,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
    },
    { headers: privateCacheHeaders() }
  );
}
