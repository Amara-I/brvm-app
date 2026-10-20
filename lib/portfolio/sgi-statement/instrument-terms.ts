import type { InstrumentKind } from "./types";

export type InstrumentTerms = {
  couponRate: number | null;
  maturityDate: string | null;
  manager: string | null;
};

const EMPTY: InstrumentTerms = { couponRate: null, maturityDate: null, manager: null };

function toYmd(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Taux, échéance ou gérant seulement s'ils sont écrits sur la ligne. */
export function termsFromLabel(label: string, kind: InstrumentKind): InstrumentTerms {
  if (kind === "action") return EMPTY;
  if (kind === "fcp") {
    const manager = label.match(/(?:gér[ée]e?\s+par|geree?\s+par|société de gestion|societe de gestion)\s+([^·|]{2,80})/i);
    return { ...EMPTY, manager: manager ? manager[1]!.replace(/\s+/g, " ").trim() : null };
  }
  const rateMatch = label.match(/(\d{1,2}(?:[.,]\d{1,4})?)\s*%/);
  const rate = rateMatch ? Number(rateMatch[1]!.replace(",", ".")) : null;
  const dateMatch = label.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  return {
    couponRate: rate != null && rate >= 0 && rate <= 100 ? rate : null,
    maturityDate: dateMatch ? toYmd(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!) : null,
    manager: null,
  };
}
