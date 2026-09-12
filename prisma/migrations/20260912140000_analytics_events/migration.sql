-- Analytique première partie : clics / pages vues (vue admin).
-- Pas de PII au-delà de user_id (session déjà authentifiée) et session_id anonyme.
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "action" TEXT,
    "user_id" TEXT,
    "session_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");
CREATE INDEX "analytics_events_feature_occurred_at_idx" ON "analytics_events"("feature", "occurred_at");
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");
CREATE INDEX "analytics_events_path_occurred_at_idx" ON "analytics_events"("path", "occurred_at");
