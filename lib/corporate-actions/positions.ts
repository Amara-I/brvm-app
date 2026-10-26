// Portefeuille : une quantité saisie AVANT la date d'effet est encore sur
// l'ancienne base (× facteur, PRU / facteur, coût total inchangé).
//
// Date d'opération, pas la date d'acquisition économique :
// - relevé SGI : « arrêté au JJ/MM/AAAA » dans la note (les quantités du
//   relevé sont déjà celles de cette date — un relevé après le split ne
//   doit pas être multiplié une seconde fois, même si le 1er achat est antérieur) ;
// - sinon la date du mouvement (`tradedAt`).
//
// Si le journal brut rejoue exactement la position stockée, on réécrit
// chaque mouvement selon sa propre date (un import mixte ancien + nouveau
// n'est pas entier × 10). Sinon (position retouchée à la main) on applique
// le facteur de la dernière opération.

import { priceDivisor } from "./adjust";
import type { AdjustmentAction } from "./types";

export interface PositionTrade {
  side: "ACHAT" | "VENTE";
  quantity: number;
  price: number;
  tradedAt: string;
  notes?: string | null;
}

export interface StoredPosition {
  quantity: number;
  avgBuyPrice: number;
  createdAt: string;
  targetPrice?: number | null;
  stopPrice?: number | null;
}

export interface DisplayPosition {
  quantity: number;
  avgBuyPrice: number;
  targetPrice: number | null;
  stopPrice: number | null;
  /** > 1 si la position affichée a été multipliée. */
  quantityFactor: number;
}

const STATEMENT_DATE = /arrêté au (\d{2})\/(\d{2})\/(\d{4})/;

export function operationDateFromTrade(trade: { tradedAt: string; notes?: string | null }): string {
  const match = trade.notes?.match(STATEMENT_DATE);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return trade.tradedAt.slice(0, 10);
}

export function positionBasisDate(trades: PositionTrade[], createdAt: string): string {
  if (trades.length === 0) return createdAt.slice(0, 10);
  return trades
    .map((trade) => operationDateFromTrade(trade))
    .sort((a, b) => b.localeCompare(a))[0]!;
}

function roundQty(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function closeEnough(a: number, b: number): boolean {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= 0.005;
}

function replay(legs: Array<{ side: "ACHAT" | "VENTE"; quantity: number; price: number; basis: string }>): {
  quantity: number;
  avgBuyPrice: number;
} | null {
  const ordered = [...legs].sort((a, b) => a.basis.localeCompare(b.basis));
  let qty = 0;
  let cost = 0;
  for (const leg of ordered) {
    if (!(leg.quantity > 0) || !(leg.price > 0)) continue;
    if (leg.side === "ACHAT") {
      cost += leg.quantity * leg.price;
      qty += leg.quantity;
      continue;
    }
    if (!(qty > 0)) return null;
    const pru = cost / qty;
    const sold = Math.min(leg.quantity, qty);
    cost -= pru * sold;
    qty -= sold;
    if (qty <= 1e-8) {
      qty = 0;
      cost = 0;
    }
  }
  if (!(qty > 0)) return { quantity: 0, avgBuyPrice: 0 };
  return { quantity: roundQty(qty), avgBuyPrice: roundMoney(cost / qty) };
}

export function displayPosition(
  stored: StoredPosition,
  trades: PositionTrade[],
  actions: AdjustmentAction[]
): DisplayPosition {
  const rawLegs = trades.map((trade) => ({
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    basis: operationDateFromTrade(trade),
  }));
  const raw = rawLegs.length > 0 ? replay(rawLegs) : null;
  const adjustedLegs = rawLegs.map((leg) => {
    const factor = priceDivisor(actions, leg.basis);
    return { ...leg, quantity: leg.quantity * factor, price: leg.price / factor };
  });
  const adjusted = adjustedLegs.length > 0 ? replay(adjustedLegs) : null;

  let quantity = stored.quantity;
  let avgBuyPrice = stored.avgBuyPrice;
  if (
    raw &&
    adjusted &&
    raw.quantity > 0 &&
    closeEnough(raw.quantity, stored.quantity) &&
    closeEnough(raw.avgBuyPrice, stored.avgBuyPrice)
  ) {
    quantity = adjusted.quantity;
    avgBuyPrice = adjusted.avgBuyPrice;
  } else {
    const factor = priceDivisor(actions, positionBasisDate(trades, stored.createdAt));
    quantity = roundQty(stored.quantity * factor);
    avgBuyPrice = roundMoney(stored.avgBuyPrice / factor);
  }

  const priceScale = avgBuyPrice > 0 && stored.avgBuyPrice > 0 ? stored.avgBuyPrice / avgBuyPrice : 1;
  const scalePx = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value) ? null : roundMoney(value / priceScale);

  return {
    quantity,
    avgBuyPrice,
    targetPrice: scalePx(stored.targetPrice),
    stopPrice: scalePx(stored.stopPrice),
    quantityFactor: stored.quantity > 0 ? quantity / stored.quantity : 1,
  };
}
