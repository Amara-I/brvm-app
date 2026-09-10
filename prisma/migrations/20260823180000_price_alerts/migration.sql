-- Alertes de seuil de cours (compte connecté)

CREATE TYPE "price_alert_direction" AS ENUM ('ABOVE', 'BELOW');
CREATE TYPE "price_alert_status" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED');

CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" "price_alert_direction" NOT NULL,
    "target_price" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "status" "price_alert_status" NOT NULL DEFAULT 'ACTIVE',
    "triggered_at" TIMESTAMP(3),
    "trigger_price" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_alerts_user_id_status_idx" ON "price_alerts"("user_id", "status");
CREATE INDEX "price_alerts_ticker_status_idx" ON "price_alerts"("ticker", "status");
CREATE INDEX "price_alerts_company_id_status_idx" ON "price_alerts"("company_id", "status");

ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
