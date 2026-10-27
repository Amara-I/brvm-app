// GET /api/companies/:ticker/close-on?date=YYYY-MM-DD
// Clôture canonique à la date demandée (ou séance précédente si non cotée).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCanonicalCloseOnOrBefore } from "@/lib/api/latest-data";
import { apiError, apiSuccess, apiNotFound } from "@/lib/api/response";
import { actionsForTicker } from "@/lib/corporate-actions/load";
import { presentClose } from "@/lib/corporate-actions/present-quotes";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker?.trim().toUpperCase();
  if (!ticker) return apiError("Ticker manquant", 400);

  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  if (!DATE_RE.test(date)) {
    return apiError("Paramètre date invalide (attendu YYYY-MM-DD)", 400);
  }

  const company = await prisma.company.findFirst({
    where: { ticker, isActive: true, exchange: "BRVM" },
    select: { id: true, ticker: true },
  });
  if (!company) return apiNotFound(`Société "${ticker}"`);

  const row = await getCanonicalCloseOnOrBefore(company.id, date);
  if (!row) {
    return apiError("Aucun cours canonique disponible pour cette date", 404);
  }

  const actions = await actionsForTicker(company.ticker).catch(() => []);
  const sessionDate = row.date.toISOString().slice(0, 10);
  const shown = presentClose(Number(row.closePrice), null, sessionDate, actions);

  return apiSuccess({
    ticker: company.ticker,
    requestedDate: date,
    date: sessionDate,
    close: shown.closePrice,
  });
}
