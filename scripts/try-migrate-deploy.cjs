#!/usr/bin/env node
// Applique les migrations Prisma au build Vercel (Hobby n'a pas de step
// "release"). Hors Vercel, no-op sauf PRISMA_MIGRATE_ON_BUILD=1.
// Ne fait jamais échouer le build : l'app reste déployable ; les tables
// absentes sont gérées en fail-soft (indices, analytics).

const { spawnSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  console.log("[migrate] skip — DATABASE_URL absent");
  process.exit(0);
}

const onVercel = process.env.VERCEL === "1";
const forced = process.env.PRISMA_MIGRATE_ON_BUILD === "1";
if (!onVercel && !forced) {
  console.log("[migrate] skip — hors Vercel (PRISMA_MIGRATE_ON_BUILD=1 pour forcer)");
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.warn(
    `[migrate] prisma migrate deploy a échoué (code ${result.status}) — le build continue. Relancer manuellement si une table manque.`
  );
}

process.exit(0);
