// POST /api/portfolio/:portfolioId/import — importe des positions depuis un .xlsx
// multipart/form-data : file=<fichier> ; query mode=merge|replace (défaut merge)

import { NextRequest } from "next/server";
import { HoldingSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api/response";
import { recordPortfolioTrade } from "@/lib/api/portfolio-trades";
import { parsePortfolioExcelBuffer } from "@/lib/portfolio/portfolio-excel";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000; // ~1,5 Mo

export async function POST(
  request: NextRequest,
  { params }: { params: { portfolioId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode = modeParam === "replace" ? "replace" : "merge";

  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Corps multipart attendu (champ « file »).", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Fichier manquant (champ « file »).", 400);
  if (file.size <= 0) return apiError("Fichier vide.", 400);
  if (file.size > MAX_BYTES) return apiError("Fichier trop volumineux (max. 1,5 Mo).", 400);

  const name = (file.name || "").toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return apiError("Format attendu : .xlsx (Excel).", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parsePortfolioExcelBuffer(buffer);
  if (parsed.rows.length === 0) {
    return apiError(parsed.errors[0] ?? "Aucune position valide à importer.", 422, {
      errors: parsed.errors,
    });
  }

  const tickers = parsed.rows.map((r) => r.ticker);
  const companies = await prisma.company.findMany({
    where: { ticker: { in: tickers }, isActive: true },
    select: { id: true, ticker: true },
  });
  const companyByTicker = new Map(companies.map((c) => [c.ticker, c]));

  const unknown: string[] = [];
  const applicable = parsed.rows.filter((r) => {
    if (!companyByTicker.has(r.ticker)) {
      unknown.push(r.ticker);
      return false;
    }
    return true;
  });

  if (applicable.length === 0) {
    return apiError(`Aucun ticker reconnu parmi : ${unknown.join(", ") || "N/D"}.`, 422, {
      errors: [...parsed.errors, ...unknown.map((t) => `Ticker inconnu : ${t}`)],
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    if (mode === "replace") {
      const del = await tx.portfolioHolding.deleteMany({ where: { portfolioId: portfolio.id } });
      deleted = del.count;
    }

    for (const row of applicable) {
      const company = companyByTicker.get(row.ticker)!;
      const buyDate = row.buyDate ? new Date(`${row.buyDate}T00:00:00.000Z`) : null;

      const existing =
        mode === "replace"
          ? null
          : await tx.portfolioHolding.findUnique({
              where: {
                uniq_holding_portfolio_company: {
                  portfolioId: portfolio.id,
                  companyId: company.id,
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
            buyHorizon: row.buyHorizon,
            notes: row.notes ?? existing.notes,
            ...(buyDate ? { buyDate } : {}),
          },
        });
        await recordPortfolioTrade(tx, {
          portfolioId: portfolio.id,
          companyId: company.id,
          side: HoldingSide.ACHAT,
          quantity: row.quantity,
          price: row.avgBuyPrice,
          tradedAt: buyDate ?? new Date(),
          notes: row.notes ? `Import Excel · ${row.notes}` : "Import Excel",
        });
        updated++;
      } else {
        await tx.portfolioHolding.create({
          data: {
            portfolioId: portfolio.id,
            companyId: company.id,
            quantity: row.quantity,
            avgBuyPrice: row.avgBuyPrice,
            lastSide: HoldingSide.ACHAT,
            buyDate: buyDate,
            buyHorizon: row.buyHorizon,
            notes: row.notes,
          },
        });
        await recordPortfolioTrade(tx, {
          portfolioId: portfolio.id,
          companyId: company.id,
          side: HoldingSide.ACHAT,
          quantity: row.quantity,
          price: row.avgBuyPrice,
          tradedAt: buyDate ?? new Date(),
          notes: row.notes ? `Import Excel · ${row.notes}` : "Import Excel",
        });
        created++;
      }
    }

    return { created, updated, deleted };
  });

  return apiSuccess({
    mode,
    imported: applicable.length,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    unknownTickers: unknown,
    warnings: parsed.errors,
  });
}
