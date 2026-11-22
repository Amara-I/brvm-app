-- Marche arrière de 20261122150000_user_plan.
-- À n'exécuter que si l'on retire le palier d'offre.

ALTER TABLE "users" DROP COLUMN IF EXISTS "plan";
DROP TYPE IF EXISTS "user_plan";
