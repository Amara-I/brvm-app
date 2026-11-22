-- Palier d'offre (FREE / LIGHT / PREMIUM) pour préparer la version payante.
-- Livrée dans la PR pour revue. Le build Vercel *tente* `prisma migrate deploy`
-- (scripts/try-migrate-deploy.cjs) si DIRECT_URL est défini, mais n'échoue
-- jamais le build en cas d'erreur : appliquer aussi manuellement après merge
-- si la colonne n'est pas encore en base.
-- Étape 1 : le code ne s'appuie pas encore sur cette colonne pour l'accès
-- (tout compte connecté = accès complet). Les requêtes `users` sensibles
-- utilisent un `select` explicite, pour que la connexion reste possible
-- tant que la migration n'est pas appliquée.

CREATE TYPE "user_plan" AS ENUM ('FREE', 'LIGHT', 'PREMIUM');

ALTER TABLE "users" ADD COLUMN "plan" "user_plan" NOT NULL DEFAULT 'FREE';
