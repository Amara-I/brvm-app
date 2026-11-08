-- Profil investisseur (âge, horizon, capacité, tolérance aux pertes, objectif).
-- Livrée dans la PR pour revue. NE PAS l'appliquer sur la base de production
-- depuis l'agent : `prisma migrate deploy` reste à lancer au déploiement,
-- après validation. Tant que la table n'existe pas, l'analyse utilise un
-- profil vide (risque 1 % par position) et l'enregistrement des critères
-- répond 503.

CREATE TYPE "investor_horizon" AS ENUM ('MOINS_1_AN', 'UN_A_3_ANS', 'TROIS_A_7_ANS', 'PLUS_7_ANS');
CREATE TYPE "investor_capacity" AS ENUM ('MODESTE', 'INTERMEDIAIRE', 'ELEVEE');
CREATE TYPE "investor_loss_tolerance" AS ENUM ('FAIBLE', 'MODEREE', 'ELEVEE');
CREATE TYPE "investor_objective" AS ENUM ('PRESERVATION', 'REVENU', 'CROISSANCE', 'CROISSANCE_AGRESSIVE');

CREATE TABLE "investor_profiles" (
    "user_id" TEXT NOT NULL,
    "age" INTEGER,
    "horizon" "investor_horizon",
    "capacity" "investor_capacity",
    "loss_tolerance" "investor_loss_tolerance",
    "objective" "investor_objective",
    "investable_capital_fcfa" DECIMAL(18,2),
    "risk_per_position_pct" DECIMAL(4,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "investor_profiles"
  ADD CONSTRAINT "investor_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
