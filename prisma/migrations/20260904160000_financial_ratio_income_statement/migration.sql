-- Comptes annuels absolus (CA, résultat net, résultat d'exploitation) en Md FCFA.
-- Affichage "N/D" tant qu'aucune source ne les renseigne.

ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "revenue" DECIMAL(14,2);
ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "net_income" DECIMAL(14,2);
ALTER TABLE "financial_ratios" ADD COLUMN IF NOT EXISTS "operating_income" DECIMAL(14,2);
