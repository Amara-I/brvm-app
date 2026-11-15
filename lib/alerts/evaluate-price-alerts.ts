// Évaluation des alertes de seuil après mise à jour des cours.

import { PriceAlertDirection, PriceAlertStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { loadLatestCanonicalPrice } from "../db/latest-canonical";
import { alertExchangeOf, priceCrossHits, type AlertExchange } from "../notifications/logic";

export interface FiredPriceAlert {
  id: string;
  userId: string;
  ticker: string;
  direction: PriceAlertDirection;
  targetPrice: number;
  triggerPrice: number;
  /** Place du titre (NGX → montants en naira, lien vers la fiche NGX). */
  exchange: AlertExchange;
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
  /** Places couvertes (ex. ["NGX"] après l'actualisation des cours NGX). Défaut : toutes. */
  exchanges?: AlertExchange[];
}): Promise<PriceAlertEvalSummary> {
  const where: {
    status: PriceAlertStatus;
    ticker?: { in: string[] };
    company?: { exchange: { in: AlertExchange[] } };
  } = { status: PriceAlertStatus.ACTIVE };
  if (options?.tickers?.length) {
    where.ticker = { in: options.tickers.map((t) => t.toUpperCase()) };
  }
  if (options?.exchanges?.length) {
    where.company = { exchange: { in: options.exchanges } };
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
      company: { select: { exchange: true } },
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
  // Dernier cours canonique non futur, sélectionné par PostgreSQL (le `distinct`
  // Prisma est appliqué en mémoire et rapatriait tout l'historique).
  const latest = await loadLatestCanonicalPrice(prisma, companyIds, { onOrBefore: new Date() });
  const priceByCompany = new Map([...latest.values()].map((p) => [p.companyId, Number(p.closePrice)]));

  for (const alert of alerts) {
    const price = priceByCompany.get(alert.companyId);
    if (price == null || !Number.isFinite(price)) continue;
    const target = Number(alert.targetPrice);
    if (!priceCrossHits(alert.direction, price, target)) continue;

    // Passage ACTIVE → TRIGGERED conditionnel : si le cron, le bouton
    // d'actualisation et la page « alertes » évaluent en même temps, un seul
    // passage obtient la transition et notifie.
    const claimed = await prisma.priceAlert.updateMany({
      where: { id: alert.id, status: PriceAlertStatus.ACTIVE },
      data: {
        status: PriceAlertStatus.TRIGGERED,
        triggeredAt: new Date(),
        triggerPrice: price,
      },
    });
    if (claimed.count === 0) continue;
    summary.triggered += 1;
    summary.alertIds.push(alert.id);
    summary.fired.push({
      id: alert.id,
      userId: alert.userId,
      ticker: alert.ticker,
      direction: alert.direction,
      targetPrice: target,
      triggerPrice: price,
      exchange: alertExchangeOf(alert.company?.exchange),
    });
  }

  return summary;
}
