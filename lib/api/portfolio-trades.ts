// Journal des mouvements portefeuille (achats / ventes + P&L réalisé).

import type { HoldingSide, Prisma, PrismaClient } from "@prisma/client";

export type TradeClient = PrismaClient | Prisma.TransactionClient;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function realizedPnl(sellPrice: number, costBasis: number, quantity: number): number {
  return roundMoney((sellPrice - costBasis) * quantity);
}

export async function recordPortfolioTrade(
  db: TradeClient,
  input: {
    portfolioId: string;
    companyId: string;
    side: HoldingSide;
    quantity: number;
    price: number;
    tradedAt?: Date;
    costBasis?: number | null;
    notes?: string | null;
  }
) {
  const tradedAt = input.tradedAt ?? new Date();
  const costBasis = input.side === "VENTE" ? (input.costBasis ?? null) : null;
  const pnl =
    input.side === "VENTE" && costBasis != null
      ? realizedPnl(input.price, costBasis, input.quantity)
      : null;

  return db.portfolioTrade.create({
    data: {
      portfolioId: input.portfolioId,
      companyId: input.companyId,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      tradedAt,
      costBasis,
      realizedPnl: pnl,
      notes: input.notes ?? null,
    },
  });
}

export type PortfolioTradeRow = {
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

export async function listPortfolioTrades(
  db: TradeClient,
  portfolioId: string,
  options?: { side?: HoldingSide; take?: number }
): Promise<PortfolioTradeRow[]> {
  const rows = await db.portfolioTrade.findMany({
    where: {
      portfolioId,
      ...(options?.side ? { side: options.side } : {}),
    },
    include: { company: { select: { ticker: true, name: true } } },
    orderBy: [{ tradedAt: "desc" }, { createdAt: "desc" }],
    take: options?.take ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    side: r.side,
    ticker: r.company.ticker,
    name: r.company.name,
    quantity: Number(r.quantity),
    price: Number(r.price),
    tradedAt: r.tradedAt.toISOString().slice(0, 10),
    costBasis: r.costBasis != null ? Number(r.costBasis) : null,
    realizedPnl: r.realizedPnl != null ? Number(r.realizedPnl) : null,
    notes: r.notes,
  }));
}

export function summarizeRealizedPnl(trades: PortfolioTradeRow[]): {
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
    totalRealizedPnl: roundMoney(total),
    salesCount: sales.length,
    lossCount,
    gainCount,
  };
}

/// Reconstitue un ACHAT d'ouverture pour chaque ligne encore ouverte qui n'a
/// aucun mouvement ACHAT en journal (positions créées avant le journal, ou
/// imports). Idempotent — ne duplique jamais si un ACHAT existe déjà.
export async function ensureOpeningTrades(db: TradeClient, portfolioId: string): Promise<number> {
  const holdings = await db.portfolioHolding.findMany({
    where: { portfolioId },
    select: {
      companyId: true,
      quantity: true,
      avgBuyPrice: true,
      buyDate: true,
      createdAt: true,
    },
  });
  if (holdings.length === 0) return 0;

  let created = 0;
  for (const h of holdings) {
    const existingBuy = await db.portfolioTrade.findFirst({
      where: { portfolioId, companyId: h.companyId, side: "ACHAT" },
      select: { id: true },
    });
    if (existingBuy) continue;

    await db.portfolioTrade.create({
      data: {
        portfolioId,
        companyId: h.companyId,
        side: "ACHAT",
        quantity: h.quantity,
        price: h.avgBuyPrice,
        tradedAt: h.buyDate ?? h.createdAt,
        notes: "Position d'ouverture (reconstitution)",
      },
    });
    created += 1;
  }
  return created;
}

/** Aligne la date du premier ACHAT journalisé sur `buyDate` corrigée. */
export async function syncOpeningBuyTradeDate(
  db: TradeClient,
  portfolioId: string,
  companyId: string,
  tradedAt: Date
): Promise<void> {
  const opening = await db.portfolioTrade.findFirst({
    where: { portfolioId, companyId, side: "ACHAT" },
    orderBy: [{ tradedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!opening) return;
  await db.portfolioTrade.update({
    where: { id: opening.id },
    data: { tradedAt },
  });
}
