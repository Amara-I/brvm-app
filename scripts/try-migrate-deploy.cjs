#!/usr/bin/env node
// Applique les migrations Prisma au build Vercel (Hobby n'a pas de step
// "release"). Hors Vercel, no-op sauf PRISMA_MIGRATE_ON_BUILD=1.
//
// Ne fait jamais échouer le build : timeout (~120s), pooler transaction
// (port 6543) ignoré, échec de migrate journalisé puis `next build` part.
//
// Connexion : DATABASE_URL reste le pooler transaction pour le runtime.
// Les migrations utilisent DIRECT_URL (session pooler Supabase, port 5432)
// uniquement dans le process enfant. On ne met pas `directUrl` dans le
// schéma : Prisma 5.22 lève P1012 si la variable est absente, y compris
// pour `prisma generate`.

const path = require("node:path");
const {
  decideMigrate,
  formatMigrateOutcome,
  resolveMigrateTimeoutMs,
  runBounded,
} = require("./migrate-on-build.cjs");

async function main() {
  const decision = decideMigrate({
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    onVercel: process.env.VERCEL === "1",
    forced: process.env.PRISMA_MIGRATE_ON_BUILD === "1",
  });

  if (decision.action === "skip") {
    console.log(decision.message);
    return;
  }

  const timeoutMs = resolveMigrateTimeoutMs(process.env.PRISMA_MIGRATE_TIMEOUT_MS);
  console.log(`${decision.message} Limite ${Math.round(timeoutMs / 1000)}s.`);

  let prismaEntry;
  try {
    prismaEntry = require.resolve("prisma/build/index.js", {
      paths: [path.join(__dirname, "..")],
    });
  } catch {
    console.warn(
      "[migrate] ÉCHEC — CLI Prisma introuvable (prisma/build/index.js). Le build continue."
    );
    return;
  }

  const result = await runBounded(process.execPath, [prismaEntry, "migrate", "deploy"], {
    timeoutMs,
    env: { ...process.env, DATABASE_URL: decision.url },
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  const outcome = formatMigrateOutcome(result, timeoutMs);
  if (outcome.ok) console.log(outcome.message);
  else console.warn(outcome.message);
}

main()
  .catch((error) => {
    const detail = error && error.message ? error.message : String(error);
    console.warn(`[migrate] ÉCHEC inattendu — le build continue. ${detail}`);
  })
  .then(() => {
    process.exit(0);
  });
