-- Alertes automatiques sur la watchlist : interrupteur + seuil de variation journalière.
ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "watchlist_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "watchlist_move_pct" DECIMAL(6, 2) NOT NULL DEFAULT 5;
