import { roundMoney } from "@/lib/api/portfolio-trades";
import { ymdToFr } from "@/lib/portfolio/portfolio-excel";

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

export function buildStatementTradeNote(issuer: string | null, statementDate: string | null): string {
  const parts = ["Import relevé SGI"];
  if (issuer) parts.push(issuer.replace(/\s+/g, " ").trim().slice(0, 80));
  if (statementDate && /^\d{4}-\d{2}-\d{2}$/.test(statementDate)) {
    parts.push(`arrêté au ${ymdToFr(statementDate)}`);
  }
  return parts.join(" · ").slice(0, 500);
}
