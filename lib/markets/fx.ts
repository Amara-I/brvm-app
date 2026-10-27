// Taux indicatif NGN → FCFA.
// EUR→NGN : open.er-api.com (attribution obligatoire à l'affichage).
// XOF est arrimé à 655,957 pour 1 euro. Ce n'est pas un cours officiel NGX/BRVM.

import type { PrismaClient } from "@prisma/client";
import { fetchJson } from "@/lib/ingestion/http-client";
import { isoDate } from "@/lib/ingestion/ngx/dates";

export const XOF_PER_EUR = 655.957;
export const FX_RATE_SOURCE = "open.er-api.com";
export const EUR_NGN_URL = "https://open.er-api.com/v6/latest/EUR";

export interface EurNgnRate {
  date: string;
  ngnPerEur: number;
  source: string;
}

export function indicativeFcfa(ngn: number, ngnPerEur: number): number | null {
  if (!(ngnPerEur > 0) || !Number.isFinite(ngn)) return null;
  const fcfa = (ngn * XOF_PER_EUR) / ngnPerEur;
  if (!Number.isFinite(fcfa)) return null;
  return Math.round(fcfa);
}

interface ErApiPayload {
  result?: string;
  rates?: { NGN?: number };
  time_last_update_unix?: number;
}

export function parseErApiNgn(payload: unknown, now = new Date()): EurNgnRate | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as ErApiPayload;
  if (body.result !== "success") return null;
  const rate = body.rates?.NGN;
  if (typeof rate !== "number" || !(rate > 0) || rate > 100_000) return null;
  const date =
    typeof body.time_last_update_unix === "number" && Number.isFinite(body.time_last_update_unix)
      ? isoDate(new Date(body.time_last_update_unix * 1000))
      : isoDate(now);
  return { date, ngnPerEur: rate, source: FX_RATE_SOURCE };
}

export async function fetchEurNgnRate(now = new Date()): Promise<EurNgnRate | null> {
  try {
    const payload = await fetchJson<unknown>(EUR_NGN_URL, { cacheTtlMs: 6 * 60 * 60 * 1000, checkRobots: true });
    return parseErApiNgn(payload, now);
  } catch {
    return null;
  }
}

export async function upsertEurNgnRate(db: PrismaClient, rate: EurNgnRate): Promise<void> {
  const date = new Date(`${rate.date.slice(0, 10)}T00:00:00.000Z`);
  await db.fxRate.upsert({
    where: {
      uniq_fx_rate_day: { date, baseCurrency: "EUR", quoteCurrency: "NGN" },
    },
    update: { rate: rate.ngnPerEur, source: rate.source },
    create: {
      date,
      baseCurrency: "EUR",
      quoteCurrency: "NGN",
      rate: rate.ngnPerEur,
      source: rate.source,
    },
  });
}

export async function latestEurNgnRate(db: PrismaClient): Promise<EurNgnRate | null> {
  const row = await db.fxRate.findFirst({
    where: { baseCurrency: "EUR", quoteCurrency: "NGN" },
    orderBy: { date: "desc" },
  });
  if (!row) return null;
  const ngnPerEur = Number(row.rate);
  if (!(ngnPerEur > 0)) return null;
  return {
    date: row.date.toISOString().slice(0, 10),
    ngnPerEur,
    source: row.source,
  };
}
