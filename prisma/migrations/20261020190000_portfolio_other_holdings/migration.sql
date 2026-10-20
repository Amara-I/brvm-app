-- Obligations et FCP du portefeuille.
-- Strictement additif : nouveaux types PostgreSQL, table neuve, index, clé
-- étrangère. Aucune colonne existante n'est modifiée. Les actions déjà
-- en base ne sont pas touchées. Sûr pour `prisma migrate deploy`.

CREATE TYPE "other_instrument_kind" AS ENUM ('OBLIGATION', 'FCP');

CREATE TYPE "other_price_mode" AS ENUM ('FCFA', 'PERCENT');

CREATE TABLE "portfolio_other_holdings" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "kind" "other_instrument_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT,
    "code" TEXT,
    "manager" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "avg_buy_price" DECIMAL(14,2) NOT NULL,
    "price_mode" "other_price_mode" NOT NULL DEFAULT 'FCFA',
    "nominal" DECIMAL(14,2),
    "coupon_rate" DECIMAL(8,4),
    "maturity_date" DATE,
    "buy_date" DATE,
    "latest_value" DECIMAL(14,4),
    "latest_value_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_other_holdings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portfolio_other_holdings_portfolio_id_kind_idx" ON "portfolio_other_holdings"("portfolio_id", "kind");

ALTER TABLE "portfolio_other_holdings" ADD CONSTRAINT "portfolio_other_holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
