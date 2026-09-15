-- Séries graphes précalculées + flag skip historique (Sika nodata).
-- Déployable plus tard si Neon est hors-ligne : le code retombe sur price_history.

ALTER TABLE "companies" ADD COLUMN "skip_history_backfill" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "history_skip_reason" TEXT;
ALTER TABLE "companies" ADD COLUMN "history_skip_until" TIMESTAMP(3);

UPDATE "companies"
SET "skip_history_backfill" = true,
    "history_skip_reason" = 'sika_nodata'
WHERE "ticker" IN ('NEIC', 'PRSC', 'SEMC', 'SICC', 'SPHC', 'STAC', 'UNLC', 'UNXC');

CREATE TYPE "chart_series_kind" AS ENUM ('COMPANY', 'INDEX');

CREATE TABLE "chart_series" (
    "id" TEXT NOT NULL,
    "kind" "chart_series_kind" NOT NULL,
    "symbol" TEXT NOT NULL,
    "company_id" TEXT,
    "range_key" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "point_count" INTEGER NOT NULL,
    "first_date" DATE,
    "last_date" DATE,
    "fingerprint" TEXT NOT NULL,
    "meta" JSONB,
    "built_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_series_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_chart_series_kind_symbol_range" ON "chart_series"("kind", "symbol", "range_key");
CREATE INDEX "chart_series_company_id_idx" ON "chart_series"("company_id");
CREATE INDEX "chart_series_kind_range_key_idx" ON "chart_series"("kind", "range_key");

ALTER TABLE "chart_series"
  ADD CONSTRAINT "chart_series_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
