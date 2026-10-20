import { roundMoney } from "@/lib/api/portfolio-trades";
import { ymdToFr } from "@/lib/portfolio/portfolio-excel";
import { fold } from "./fold";
import type { OtherInstrumentKind, OtherPriceMode } from "@/lib/calc/other-holding-metrics";

export type ConfirmedStatementRow = {
  companyId: string;
  quantity: number;
  avgBuyPrice: number;
  /** Premier achat lu sur l'historique, YYYY-MM-DD. */
  buyDate?: string | null;
};

export type ConsolidatedStatementRow = ConfirmedStatementRow;

function roundQty(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Additionne les lignes d'une même société et recalcule le PRU pondéré. */
export function consolidateImportRows(rows: readonly ConfirmedStatementRow[]): ConsolidatedStatementRow[] {
  const grouped = new Map<string, { quantity: number; cost: number; buyDate: string | null }>();
  for (const row of rows) {
    if (!(row.quantity > 0) || !(row.avgBuyPrice > 0) || !row.companyId) continue;
    const current = grouped.get(row.companyId) ?? { quantity: 0, cost: 0, buyDate: null };
    current.quantity += row.quantity;
    current.cost += row.quantity * row.avgBuyPrice;
    if (row.buyDate && /^\d{4}-\d{2}-\d{2}$/.test(row.buyDate)) {
      if (!current.buyDate || row.buyDate < current.buyDate) current.buyDate = row.buyDate;
    }
    grouped.set(row.companyId, current);
  }
  return [...grouped.entries()].map(([companyId, value]) => {
    const row = {
      companyId,
      quantity: roundQty(value.quantity),
      avgBuyPrice: roundMoney(value.cost / value.quantity),
    };
    return value.buyDate ? { ...row, buyDate: value.buyDate } : row;
  });
}

export type ConfirmedOtherRow = {
  kind: OtherInstrumentKind;
  name: string;
  isin?: string | null;
  code?: string | null;
  manager?: string | null;
  quantity: number;
  avgBuyPrice: number;
  priceMode?: OtherPriceMode | null;
  nominal?: number | null;
  couponRate?: number | null;
  maturityDate?: string | null;
  buyDate?: string | null;
  latestValue?: number | null;
};

function cleanIsin(value: string | null | undefined): string | null {
  const compact = (value ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(compact) ? compact : null;
}

function foldName(value: string): string {
  return fold(value).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Même instrument + même unité de prix. Un % ne se moyenne pas avec un prix en FCFA. */
export function otherInstrumentKey(row: {
  kind: string;
  name: string;
  isin?: string | null;
  priceMode?: string | null;
}): string {
  const isin = cleanIsin(row.isin);
  const identity = isin ? `isin:${isin}` : `name:${foldName(row.name)}`;
  const mode = row.priceMode === "PERCENT" ? "PERCENT" : "FCFA";
  return `${row.kind}:${mode}:${identity}`;
}

/** Additionne les achats d'une même obligation ou d'un même FCP (PRU pondéré). */
export function consolidateOtherRows(rows: readonly ConfirmedOtherRow[]): ConfirmedOtherRow[] {
  const grouped = new Map<
    string,
    ConfirmedOtherRow & { cost: number }
  >();
  for (const row of rows) {
    const name = row.name.replace(/\s+/g, " ").trim();
    if (!name || !(row.quantity > 0) || !(row.avgBuyPrice > 0)) continue;
    const priceMode: OtherPriceMode = row.kind === "FCP" ? "FCFA" : row.priceMode === "PERCENT" ? "PERCENT" : "FCFA";
    const key = otherInstrumentKey({ ...row, name, priceMode });
    const current = grouped.get(key);
    const buyDate = row.buyDate && /^\d{4}-\d{2}-\d{2}$/.test(row.buyDate) ? row.buyDate : null;
    if (!current) {
      grouped.set(key, {
        kind: row.kind,
        name,
        isin: cleanIsin(row.isin),
        code: row.code?.trim() || null,
        manager: row.manager?.trim() || null,
        quantity: row.quantity,
        avgBuyPrice: row.avgBuyPrice,
        priceMode,
        nominal: row.nominal != null && row.nominal > 0 ? row.nominal : null,
        couponRate: row.couponRate != null && row.couponRate >= 0 ? row.couponRate : null,
        maturityDate: row.maturityDate && /^\d{4}-\d{2}-\d{2}$/.test(row.maturityDate) ? row.maturityDate : null,
        buyDate,
        latestValue: row.latestValue != null && row.latestValue > 0 ? row.latestValue : null,
        cost: row.quantity * row.avgBuyPrice,
      });
      continue;
    }
    current.quantity += row.quantity;
    current.cost += row.quantity * row.avgBuyPrice;
    if (buyDate && (!current.buyDate || buyDate < current.buyDate)) current.buyDate = buyDate;
    if (current.nominal == null && row.nominal != null && row.nominal > 0) current.nominal = row.nominal;
    if (current.couponRate == null && row.couponRate != null && row.couponRate >= 0) current.couponRate = row.couponRate;
    if (current.maturityDate == null && row.maturityDate) current.maturityDate = row.maturityDate;
    if (current.manager == null && row.manager?.trim()) current.manager = row.manager.trim();
    if (row.latestValue != null && row.latestValue > 0) current.latestValue = row.latestValue;
  }
  return [...grouped.values()].map((row) => {
    const { cost, ...rest } = row;
    return { ...rest, quantity: roundQty(row.quantity), avgBuyPrice: roundMoney(cost / row.quantity) };
  });
}

export function buildStatementTradeNote(issuer: string | null, statementDate: string | null): string {
  const parts = ["Import relevé SGI"];
  if (issuer) parts.push(issuer.replace(/\s+/g, " ").trim().slice(0, 80));
  if (statementDate && /^\d{4}-\d{2}-\d{2}$/.test(statementDate)) {
    parts.push(`arrêté au ${ymdToFr(statementDate)}`);
  }
  return parts.join(" · ").slice(0, 500);
}
