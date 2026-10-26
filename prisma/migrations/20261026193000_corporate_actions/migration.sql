-- Opérations sur titres (fractionnement). Les cours bruts ne sont pas réécrits.
-- SNTS 1:10 du 26/10/2026 est activé. Les fractionnements 2018-2019 sont
-- insérés désactivés : `npm run corporate-actions:apply` ne les active
-- qu'après avoir constaté un saut non ajusté dans price_history.

CREATE TYPE "corporate_action_type" AS ENUM ('SPLIT', 'REVERSE_SPLIT', 'BONUS');

CREATE TABLE "corporate_actions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "corporate_action_type" NOT NULL,
    "effective_date" DATE NOT NULL,
    "new_shares" DECIMAL(12,4) NOT NULL,
    "old_shares" DECIMAL(12,4) NOT NULL,
    "nominal_before" DECIMAL(14,2),
    "nominal_after" DECIMAL(14,2),
    "source_url" TEXT,
    "note" TEXT,
    "adjust_prices" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_corporate_action" ON "corporate_actions"("company_id", "effective_date", "type");
CREATE INDEX "corporate_actions_company_id_effective_date_idx" ON "corporate_actions"("company_id", "effective_date");

ALTER TABLE "corporate_actions"
  ADD CONSTRAINT "corporate_actions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "corporate_actions" (
  "id", "company_id", "type", "effective_date", "new_shares", "old_shares",
  "nominal_before", "nominal_after", "source_url", "note", "adjust_prices", "updated_at"
)
SELECT
  'ca_' || c.ticker || '_' || to_char(v.effective_date, 'YYYYMMDD'),
  c.id,
  'SPLIT'::"corporate_action_type",
  v.effective_date,
  v.new_shares,
  v.old_shares,
  v.nominal_before,
  v.nominal_after,
  v.source_url,
  v.note,
  v.adjust_prices,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('SNTS', DATE '2026-10-26', 10::numeric, 1::numeric, 500::numeric, 50::numeric,
    'https://www.brvm.org/fr/sonatel-sn-fractionnement-de-laction',
    'Sonatel : 10 actions nouvelles pour 1 ancienne, nominal 500 → 50 FCFA.',
    true),
  ('PRSC', DATE '2019-10-25', 64, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'Tractafric CI (PRSC), 64 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('SMBC', DATE '2019-02-25', 4, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'SMB CI, 4 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('ECOC', DATE '2018-12-27', 5, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'Ecobank CI, 5 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('SEMC', DATE '2018-12-20', 40, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'Crown SIEM CI (SEMC), 40 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('SAFC', DATE '2018-12-24', 5, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'SAFCA CI, 5 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('ONTBF', DATE '2018-08-29', 2, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'ONATEL BF, 2 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false),
  ('STBC', DATE '2018-07-27', 20, 1, NULL, NULL,
    'https://www.brvm.org/fr/esv/fractionnement',
    'SITAB CI, 20 pour 1. Désactivé tant que l''historique n''a pas été vérifié.',
    false)
) AS v(ticker, effective_date, new_shares, old_shares, nominal_before, nominal_after, source_url, note, adjust_prices)
JOIN "companies" c ON c.ticker = v.ticker
ON CONFLICT ("company_id", "effective_date", "type") DO NOTHING;
