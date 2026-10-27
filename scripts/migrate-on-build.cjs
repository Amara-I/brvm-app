"use strict";

// Décision pure + exécution bornée de `prisma migrate deploy` au build.
//
// `directUrl = env("DIRECT_URL")` n'est PAS dans schema.prisma. Vérifié avec
// Prisma 5.22.0 : si DIRECT_URL est absente ou vide, `prisma validate` /
// `prisma generate` échouent immédiatement (P1012), avant toute connexion.
// Le client runtime, lui, n'utilise que DATABASE_URL. On n'injecte donc la
// connexion session/directe que dans le process enfant de migrate.

const { spawn } = require("node:child_process");

const DEFAULT_MIGRATE_TIMEOUT_MS = 120_000;
const MIN_MIGRATE_TIMEOUT_MS = 1_000;

function inspectConnection(connectionString) {
  const raw = typeof connectionString === "string" ? connectionString.trim() : "";
  if (!raw) {
    return { present: false, port: null, transactionPooler: false, parseable: false };
  }

  // `new URL` rejette un `#` non encodé dans le mot de passe. On retombe
  // alors sur le dernier `@` (hôte:port), sans jamais logger la chaîne.
  const pgbouncer = /(?:\?|&)pgbouncer=true(?:&|$)/i.test(raw);
  let port = null;
  let parseable = false;

  try {
    const url = new URL(raw);
    if (url.protocol === "postgres:" || url.protocol === "postgresql:") {
      parseable = true;
      port = url.port || null;
    }
  } catch {
    const scheme = raw.match(/^(?:postgres(?:ql)?:\/\/)/i);
    if (scheme) {
      const rest = raw.slice(scheme[0].length);
      const at = rest.lastIndexOf("@");
      const hostpart = (at >= 0 ? rest.slice(at + 1) : rest).split("?")[0].split("#")[0];
      const hostMatch = hostpart.match(/^(?:\[[^\]]+\]|[^/:]+)(?::(\d+))?/);
      if (hostMatch) {
        parseable = true;
        port = hostMatch[1] || null;
      }
    }
  }

  return {
    present: true,
    port,
    transactionPooler: port === "6543" || pgbouncer,
    parseable,
  };
}

function skip(code, message) {
  return { action: "skip", code, message };
}

function decideMigrate(input) {
  const databaseUrl = typeof input.databaseUrl === "string" ? input.databaseUrl.trim() : "";
  const directUrl = typeof input.directUrl === "string" ? input.directUrl.trim() : "";
  const onVercel = input.onVercel === true;
  const forced = input.forced === true;

  if (!databaseUrl) {
    return skip("database-url-absent", "[migrate] skip — DATABASE_URL absent");
  }
  if (!onVercel && !forced) {
    return skip(
      "not-vercel",
      "[migrate] skip — hors Vercel (PRISMA_MIGRATE_ON_BUILD=1 pour forcer)"
    );
  }

  if (directUrl) {
    const direct = inspectConnection(directUrl);
    if (!direct.parseable) {
      return skip(
        "direct-url-unparseable",
        "[migrate] skip — DIRECT_URL illisible. Migrations non appliquées. " +
          "Attendu : chaîne Supabase « Session pooler », hôte *.pooler.supabase.com, port 5432, sans pgbouncer=true. " +
          "Le build continue."
      );
    }
    if (direct.transactionPooler) {
      return skip(
        "direct-url-transaction-pooler",
        "[migrate] skip — DIRECT_URL pointe vers le pooler transaction (port 6543 ou pgbouncer=true). " +
          "prisma migrate deploy s'y bloque. Utiliser la chaîne Supabase « Session pooler », port 5432, sans pgbouncer=true. " +
          "Migrations non appliquées. Le build continue."
      );
    }
    return {
      action: "migrate",
      code: "run",
      url: directUrl,
      via: "DIRECT_URL",
      port: direct.port,
      message:
        `[migrate] prisma migrate deploy via DIRECT_URL (port ${direct.port || "5432 (défaut)"}). ` +
        "Le runtime continue d'utiliser DATABASE_URL.",
    };
  }

  const database = inspectConnection(databaseUrl);
  if (!database.parseable) {
    return skip(
      "database-url-unparseable",
      "[migrate] skip — DATABASE_URL illisible et DIRECT_URL absente. Migrations non appliquées " +
        "(évite un blocage sur le pooler transaction). Ajouter DIRECT_URL = chaîne Supabase « Session pooler », port 5432. " +
        "Le build continue."
    );
  }
  if (database.transactionPooler) {
    return skip(
      "direct-url-absent",
      "[migrate] skip — DIRECT_URL absent et DATABASE_URL est le pooler transaction Supabase (port 6543 ou pgbouncer=true). " +
        "prisma migrate deploy s'y bloque, donc les migrations ne sont pas lancées. " +
        "Ajouter sur Vercel la variable DIRECT_URL = chaîne « Session pooler » (hôte *.pooler.supabase.com, port 5432, sans pgbouncer=true), puis redéployer. " +
        "Le build continue."
    );
  }

  return {
    action: "migrate",
    code: "run",
    url: databaseUrl,
    via: "DATABASE_URL",
    port: database.port,
    message:
      `[migrate] prisma migrate deploy via DATABASE_URL (port ${database.port || "5432 (défaut)"}). ` +
      "DIRECT_URL absente : cette URL n'est pas le pooler transaction.",
  };
}

function resolveMigrateTimeoutMs(raw) {
  if (raw == null || String(raw).trim() === "") return DEFAULT_MIGRATE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < MIN_MIGRATE_TIMEOUT_MS) return DEFAULT_MIGRATE_TIMEOUT_MS;
  return Math.floor(parsed);
}

function killProcessGroup(pid) {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // déjà terminé
    }
  }
}

function runBounded(command, args, options = {}) {
  const timeoutMs = options.timeoutMs;
  const graceMs = options.graceMs ?? 2_000;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: options.stdio ?? "inherit",
        env: options.env ?? process.env,
        cwd: options.cwd,
        detached: true,
      });
    } catch (error) {
      resolve({ timedOut: false, status: null, signal: null, error });
      return;
    }

    let timedOut = false;
    let settled = false;
    let graceTimer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve(result);
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child.pid);
      graceTimer = setTimeout(() => {
        child.unref();
        finish({ timedOut: true, status: null, signal: "SIGKILL", error: null });
      }, graceMs);
    }, timeoutMs);

    child.on("error", (error) => {
      finish({ timedOut: false, status: null, signal: null, error });
    });
    child.on("exit", (code, signal) => {
      finish({ timedOut, status: code, signal, error: null });
    });
  });
}

function formatMigrateOutcome(result, timeoutMs) {
  const seconds = Math.round(timeoutMs / 1000);
  if (result.timedOut) {
    return {
      ok: false,
      message:
        `[migrate] TIMEOUT — prisma migrate deploy interrompu après ${seconds}s (processus tué). ` +
        "Migrations peut-être non appliquées. Le build continue.",
    };
  }
  if (result.error) {
    const detail = result.error.message ? result.error.message : String(result.error);
    return {
      ok: false,
      message: `[migrate] ÉCHEC prisma migrate deploy (${detail}) — le build continue.`,
    };
  }
  if (result.status === 0) {
    return { ok: true, message: "[migrate] OK — migrations à jour" };
  }
  const code = result.status == null ? "null" : String(result.status);
  return {
    ok: false,
    message:
      `[migrate] ÉCHEC prisma migrate deploy (code ${code}) — le build continue. ` +
      "Relancer manuellement si une table manque.",
  };
}

module.exports = {
  DEFAULT_MIGRATE_TIMEOUT_MS,
  decideMigrate,
  formatMigrateOutcome,
  inspectConnection,
  resolveMigrateTimeoutMs,
  runBounded,
};
