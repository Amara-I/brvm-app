-- Phase 1 NGX — place de cotation, devise, source officielle, taux EUR/NGN.
--
-- Le build Vercel (override dashboard) peut sauter `prisma migrate deploy`.
-- Appliquer ce fichier à la main sur Supabase AVANT que le déploiement
-- qui contient ce schéma ne serve le trafic, sinon les lectures Prisma
-- (colonne `companies.exchange`) échouent.
--
-- psql "$DATABASE_URL" -f prisma/migrations/20261027190000_ngx_exchange_scope/migration.sql
-- puis, si la table `_prisma_migrations` est suivie :
--   npx prisma migrate resolve --applied 20261027190000_ngx_exchange_scope

-- AlterEnum (PostgreSQL 12+ : ADD VALUE est autorisé dans une transaction
-- tant que la nouvelle valeur n'est pas utilisée dans la même transaction).
ALTER TYPE "data_source" ADD VALUE IF NOT EXISTS 'NGX_OFFICIEL';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exchange_code') THEN
    CREATE TYPE "exchange_code" AS ENUM ('BRVM', 'NGX');
  END IF;
END $$;

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "exchange" "exchange_code" NOT NULL DEFAULT 'BRVM',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'XOF';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_company_exchange_ticker"
  ON "companies"("exchange", "ticker");
CREATE INDEX IF NOT EXISTS "companies_exchange_idx" ON "companies"("exchange");

ALTER TABLE "market_indices"
  ADD COLUMN IF NOT EXISTS "exchange" "exchange_code" NOT NULL DEFAULT 'BRVM',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'XOF';

CREATE INDEX IF NOT EXISTS "market_indices_exchange_idx" ON "market_indices"("exchange");

ALTER TABLE "chart_series"
  ADD COLUMN IF NOT EXISTS "exchange" "exchange_code" NOT NULL DEFAULT 'BRVM';

CREATE INDEX IF NOT EXISTS "chart_series_exchange_kind_range_key_idx"
  ON "chart_series"("exchange", "kind", "range_key");

CREATE TABLE IF NOT EXISTS "fx_rates" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "base_currency" TEXT NOT NULL,
  "quote_currency" TEXT NOT NULL,
  "rate" DECIMAL(18,6) NOT NULL,
  "source" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_fx_rate_day"
  ON "fx_rates"("date", "base_currency", "quote_currency");
CREATE INDEX IF NOT EXISTS "fx_rates_base_currency_quote_currency_date_idx"
  ON "fx_rates"("base_currency", "quote_currency", "date");

-- Nigeria, pour les sociétés NGX. Idempotent.
INSERT INTO "countries" ("id", "code", "name", "flag_emoji")
SELECT 'country_ng', 'NG', 'Nigeria', '🇳🇬'
WHERE NOT EXISTS (SELECT 1 FROM "countries" WHERE "code" = 'NG');
