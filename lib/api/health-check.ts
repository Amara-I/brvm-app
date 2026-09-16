// Sonde Prisma minimale pour GET /api/health.
// `SELECT 1` uniquement — pas de scan de tables, pas de secrets dans la
// réponse. Réutilise `isDatabaseUnavailable` pour classer les erreurs
// d'infra sans jamais les renvoyer au client.

import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

/** Délai max de la sonde : un monitor ne doit pas attendre le timeout Vercel. */
export const HEALTH_DB_TIMEOUT_MS = 3_000;

export type DatabaseHealthCheck = {
  ok: boolean;
  latencyMs: number;
};

export type HealthPayload = {
  ok: boolean;
  checks: {
    database: DatabaseHealthCheck;
  };
};

export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export function buildHealthPayload(database: DatabaseHealthCheck): {
  status: 200 | 503;
  body: HealthPayload;
} {
  const ok = database.ok;
  return {
    status: ok ? 200 : 503,
    body: { ok, checks: { database } },
  };
}

export async function probeDatabase(
  ping: () => Promise<unknown> = pingDatabase,
  timeoutMs = HEALTH_DB_TIMEOUT_MS
): Promise<DatabaseHealthCheck> {
  const started = Date.now();
  try {
    await withTimeout(ping(), timeoutMs);
    return { ok: true, latencyMs: elapsedMs(started) };
  } catch (err) {
    // Toute erreur (base down, timeout, init Prisma) = unhealthy.
    // `isDatabaseUnavailable` sert uniquement à éviter un log trop bruyant
    // sur le cas attendu "Supabase injoignable" ; le message brut n'est
    // jamais inclus dans la réponse (hôte, port, DATABASE_URL…).
    if (!isDatabaseUnavailable(err)) {
      console.error("[health] échec de la sonde Prisma");
    }
    return { ok: false, latencyMs: elapsedMs(started) };
  }
}

function elapsedMs(started: number): number {
  return Math.max(0, Date.now() - started);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("ETIMEDOUT"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
