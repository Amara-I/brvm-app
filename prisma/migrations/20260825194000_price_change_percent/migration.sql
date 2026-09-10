-- Variation journalière officielle (ex. colonne BRVM « Variation (%) »).
ALTER TABLE "price_history" ADD COLUMN IF NOT EXISTS "change_percent" DECIMAL(8,4);
