-- Notifications in-app, règles d'alerte étendues, préférences, objectif/stop portefeuille.
-- Horodatage après 20260913120000_auth_tokens (même date, conflit de merge main).

CREATE TYPE "notification_type" AS ENUM ('PRIX', 'SIGNAUX', 'PORTEFEUILLE', 'INDICES', 'SYSTEME');
CREATE TYPE "alert_rule_kind" AS ENUM ('DAILY_MOVE', 'HORIZON_MOVE', 'SIGNAL_ENTRY', 'INDEX_MOVE');
CREATE TYPE "notification_delivery_mode" AS ENUM ('REALTIME', 'DIGEST');

ALTER TABLE "portfolio_holdings" ADD COLUMN "target_price" DECIMAL(14,2);
ALTER TABLE "portfolio_holdings" ADD COLUMN "stop_price" DECIMAL(14,2);

CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "alert_rule_kind" NOT NULL,
    "ticker" TEXT,
    "company_id" TEXT,
    "index_code" TEXT,
    "params" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_fired_at" TIMESTAMP(3),
    "last_fire_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_rules_user_id_kind_enabled_idx" ON "alert_rules"("user_id", "kind", "enabled");
CREATE INDEX "alert_rules_ticker_enabled_idx" ON "alert_rules"("ticker", "enabled");
CREATE INDEX "alert_rules_index_code_enabled_idx" ON "alert_rules"("index_code", "enabled");

ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "ticker" TEXT,
    "index_code" TEXT,
    "read_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "email_sent_at" TIMESTAMP(3),
    "email_error" TEXT,
    "alert_rule_id" TEXT,
    "price_alert_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_events_user_id_created_at_idx" ON "notification_events"("user_id", "created_at");
CREATE INDEX "notification_events_user_id_read_at_idx" ON "notification_events"("user_id", "read_at");
CREATE INDEX "notification_events_type_created_at_idx" ON "notification_events"("type", "created_at");
CREATE INDEX "notification_events_price_alert_id_idx" ON "notification_events"("price_alert_id");

ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "price_enabled" BOOLEAN NOT NULL DEFAULT true,
    "signal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "portfolio_enabled" BOOLEAN NOT NULL DEFAULT true,
    "index_enabled" BOOLEAN NOT NULL DEFAULT false,
    "system_enabled" BOOLEAN NOT NULL DEFAULT true,
    "channel_in_app" BOOLEAN NOT NULL DEFAULT true,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "delivery_mode" "notification_delivery_mode" NOT NULL DEFAULT 'REALTIME',
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "session_reminders" BOOLEAN NOT NULL DEFAULT false,
    "portfolio_move_pct" DECIMAL(6,2) NOT NULL DEFAULT 5,
    "index_move_pct" DECIMAL(6,2) NOT NULL DEFAULT 1.5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
