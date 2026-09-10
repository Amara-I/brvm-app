-- Journal des mouvements portefeuille (achats / ventes + P&L réalisé).
CREATE TABLE IF NOT EXISTS "portfolio_trades" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "side" "holding_side" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "traded_at" DATE NOT NULL,
    "cost_basis" DECIMAL(14,2),
    "realized_pnl" DECIMAL(18,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "portfolio_trades_portfolio_id_traded_at_idx" ON "portfolio_trades"("portfolio_id", "traded_at");
CREATE INDEX IF NOT EXISTS "portfolio_trades_portfolio_id_side_idx" ON "portfolio_trades"("portfolio_id", "side");

DO $$ BEGIN
  ALTER TABLE "portfolio_trades" ADD CONSTRAINT "portfolio_trades_portfolio_id_fkey"
    FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "portfolio_trades" ADD CONSTRAINT "portfolio_trades_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
