// Évaluation des alertes de seuil après mise à jour des cours.

import { PriceAlertDirection, PriceAlertStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { priceCrossHits } from "../notifications/logic";

export interface FiredPriceAlert {
  id: string;
  userId: string;
  ticker: string;
  direction: PriceAlertDirection;
  targetPrice: number;
  triggerPrice: number;
}

export interface PriceAlertEvalSummary {
  checked: number;
  triggered: number;
  alertIds: string[];
  fired: FiredPriceAlert[];
}

/**
 * Compare chaque alerte ACTIVE au dernier cours canonique du titre.
 * Si le seuil est atteint → statut TRIGGERED + horodatage.
 */
export async function evaluateActivePriceAlerts(options?: {
  tickers?: string[];
}): Promise<PriceAlertEvalSummary> {
  const where: {
    status: PriceAlertStatus;
    ticker?: { in: string[] };
  } = { status: PriceAlertStatus.ACTIVE };
  if (options?.tickers?.length) {
    where.ticker = { in: options.tickers.map((t) => t.toUpperCase()) };
  }

  const alerts = await prisma.priceAlert.findMany({
    where,
    select: {
      id: true,
      userId: true,
      companyId: true,
      ticker: true,
      direction: true,
      targetPrice: true,
    },
  });

  const summary: PriceAlertEvalSummary = {
    checked: alerts.length,
    triggered: 0,
    alertIds: [],
    fired: [],
  };
  if (alerts.length === 0) return summary;

  const companyIds = [...new Set(alerts.map((a) => a.companyId))];
  const latest = await prisma.priceHistory.findMany({
    where: { companyId: { in: companyIds }, isCanonical: true, date: { lte: new Date() } },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    distinct: ["companyId"],
    select: { companyId: true, closePrice: true },
  });
  const priceByCompany = new Map(latest.map((p) => [p.companyId, Number(p.closePrice)]));

  for (const alert of alerts) {
    const price = priceByCompany.get(alert.companyId);
    if (price == null || !Number.isFinite(price)) continue;
    const target = Number(alert.targetPrice);
    if (!priceCrossHits(alert.direction, price, target)) continue;

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: {
        status: PriceAlertStatus.TRIGGERED,
        triggeredAt: new Date(),
        triggerPrice: price,
      },
    });
    summary.triggered += 1;
    summary.alertIds.push(alert.id);
    summary.fired.push({
      id: alert.id,
      userId: alert.userId,
      ticker: alert.ticker,
      direction: alert.direction,
      targetPrice: target,
      triggerPrice: price,
    });
  }

  return summary;
}
