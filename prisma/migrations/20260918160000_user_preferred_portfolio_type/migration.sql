-- Type de portefeuille pédagogique + préférence utilisateur (Profil).
-- N'altère aucune donnée de marché : cadrage d'analyse uniquement.

CREATE TYPE "portfolio_type" AS ENUM ('CROISSANCE', 'RENTE', 'TRADING', 'CROISSANCE_MAX');

ALTER TABLE "users" ADD COLUMN "preferred_portfolio_type" "portfolio_type";
