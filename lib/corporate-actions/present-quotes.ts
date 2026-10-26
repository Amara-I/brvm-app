// Présentation d'un cours ou d'un dividende par action déjà ajusté.
// Les lignes brutes en base ne sont pas réécrites.

import { adjustPerShareAmount, dividendBasisDate, priceDivisor, roundPrice } from "./adjust";
import type { AdjustmentAction } from "./types";

export function presentClose(
  close: number,
  volume: number | null,
  date: string,
  actions: AdjustmentAction[]
): { closePrice: number; volume: number | null } {
  const divisor = priceDivisor(actions, date);
  return {
    closePrice: roundPrice(close / divisor),
    volume: volume == null || !Number.isFinite(volume) ? null : Math.round(volume * divisor),
  };
}

export function presentDividend(
  amount: number,
  year: number,
  exDate: string | null | undefined,
  actions: AdjustmentAction[]
): number {
  return adjustPerShareAmount(amount, dividendBasisDate(year, exDate, actions), actions);
}
