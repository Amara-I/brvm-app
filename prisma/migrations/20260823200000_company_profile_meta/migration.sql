-- Profil société étendu (Sikafinance SOCIETE)

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "profile_meta" JSONB;
