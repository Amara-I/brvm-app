// Constantes / helpers purs (sans Prisma) — utilisables côté client.

export type PortfolioTradeRowLite = {
  id: string;
  side: "ACHAT" | "VENTE";
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  tradedAt: string;
  costBasis: number | null;
  realizedPnl: number | null;
  notes: string | null;
};

export function summarizeRealizedPnlClient(trades: PortfolioTradeRowLite[]): {
  totalRealizedPnl: number;
  salesCount: number;
  lossCount: number;
  gainCount: number;
} {
  const sales = trades.filter((t) => t.side === "VENTE");
  let total = 0;
  let lossCount = 0;
  let gainCount = 0;
  for (const t of sales) {
    const pnl = t.realizedPnl ?? 0;
    total += pnl;
    if (pnl < 0) lossCount++;
    else if (pnl > 0) gainCount++;
  }
  return {
    totalRealizedPnl: Math.round(total * 100) / 100,
    salesCount: sales.length,
    lossCount,
    gainCount,
  };
}

export const PORTFOLIO_TRADES_CHANGED_EVENT = "ouestbourse:portfolio-trades-changed";
export const PORTFOLIO_CHANGED_EVENT = "ouestbourse:portfolio-changed";

export function notifyPortfolioChanged(portfolioId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PORTFOLIO_CHANGED_EVENT, { detail: { portfolioId } })
  );
}

export function notifyPortfolioTradesChanged(portfolioId: string) {
  notifyPortfolioChanged(portfolioId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PORTFOLIO_TRADES_CHANGED_EVENT, { detail: { portfolioId } })
  );
}
