-- Indicateurs fondamentaux additionnels (Guide indicateurs BRVM)
-- Colonnes optionnelles : affichage "N/D" tant qu'aucune source ne les renseigne.

ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "debt_ratio" DECIMAL(8,2);
ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "pb_ratio" DECIMAL(8,2);
ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "revenue_growth" DECIMAL(8,2);
ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "fcf" DECIMAL(14,2);
