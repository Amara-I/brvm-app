// Fiche d'indice : séries et variations des composantes, lues avec peu d'octets.
//
// Egress Supabase : on ne lit jamais tout l'historique de tous les indices.
// Pour UN indice, PostgreSQL renvoie seulement (date, valeur) :
//   - chaque séance des 800 derniers jours (1M → 1A, analyse technique, stats 52 sem.) ;
//   - la dernière séance de chaque semaine entre 800 jours et 5 ans ;
//   - la dernière séance de chaque mois au-delà de 5 ans, plus le tout premier point.
// Soit ≈ 550 + 145 + 130 lignes (≈ 25 ko) pour le Composite, une fois par heure au plus
// (cache `unstable_cache`, étiquette `market-indices` invalidée après l'ingestion).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cachedLoader,
  MARKET_INDICES_REVALIDATE_S,
  MARKET_INDICES_TAG,
} from "@/lib/cache/market-cache";
import { isMissingDatabaseObject, isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import type { StoredIndexComposition } from "@/lib/markets/index-view";

/** Jours de séances quotidiennes conservées (≥ fenêtre d'analyse technique NGX/BRVM). */
export const INDEX_DAILY_DAYS = 800;
/** Au-delà de 800 jours et jusqu'à 5 ans : un point par semaine. Ensuite : un point par mois. */
export const INDEX_WEEKLY_YEARS = 5;

export interface IndexSeriesPoint {
  time: string;
  value: number;
}

export interface IndexSheetBundle {
  id: string;
  code: string;
  name: string;
  exchange: "BRVM" | "NGX";
  /** Série composée (quotidien récent, hebdo puis mensuel), triée par date. */
  series: IndexSeriesPoint[];
  /** Séances canoniques distinctes en base (pas seulement les points envoyés). */
  historyPoints: number;
  firstDate: string | null;
  /** Plus haut historique (toutes séances). */
  athValue: number | null;
  athDate: string | null;
  /** Variation publiée de la dernière séance (%), null = calcul sur la séance précédente. */
  lastChangePercent: number | null;
  lastSource: string | null;
  storedComposition: StoredIndexComposition | null;
}

const iso = (d: Date | string): string => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** SQL : série composée d'un indice (voir l'en-tête). Exporté pour les tests. */
export function composedIndexSeriesSql(marketIndexId: string): Prisma.Sql {
  return Prisma.sql`
    WITH s AS (
      SELECT DISTINCT ON (v.date) v.date, v.value
      FROM market_index_values v
      WHERE v.market_index_id = ${marketIndexId}
        AND v.is_canonical = true
        AND v.date <= CURRENT_DATE
      ORDER BY v.date, v.created_at DESC
    ), b AS (
      SELECT date, value, max(date) OVER () AS last_d, min(date) OVER () AS first_d FROM s
    )
    SELECT DISTINCT ON (bucket) date, value
    FROM (
      SELECT date, value,
        CASE
          WHEN date = first_d THEN 'first'
          WHEN date >= last_d - ${INDEX_DAILY_DAYS}::int THEN 'd' || to_char(date, 'YYYY-MM-DD')
          WHEN date >= (last_d - make_interval(years => ${INDEX_WEEKLY_YEARS}::int))::date
            THEN 'w' || to_char(date_trunc('week', date), 'YYYY-MM-DD')
          ELSE 'm' || to_char(date_trunc('month', date), 'YYYY-MM')
        END AS bucket
      FROM b
    ) x
    ORDER BY bucket, date DESC
  `;
}

async function loadStoredComposition(marketIndexId: string): Promise<StoredIndexComposition | null> {
  try {
    const latest = await prisma.marketIndexConstituent.findFirst({
      where: { marketIndexId },
      orderBy: [{ asOf: "desc" }, { source: "asc" }],
      select: { asOf: true, source: true, note: true },
    });
    if (!latest) return null;
    const rows = await prisma.marketIndexConstituent.findMany({
      where: { marketIndexId, asOf: latest.asOf, source: latest.source },
      orderBy: { ticker: "asc" },
      select: { ticker: true, weight: true },
    });
    if (rows.length === 0) return null;
    return {
      tickers: rows.map((row) => ({ ticker: row.ticker, weight: row.weight != null ? Number(row.weight) : null })),
      asOf: iso(latest.asOf),
      note: latest.note,
      official: latest.source === "BRVM_OFFICIEL",
    };
  } catch (err) {
    if (isMissingDatabaseObject(err) || isDatabaseUnavailable(err)) return null;
    throw err;
  }
}

async function loadIndexSheetBundleUncached(code: string, exchange: "BRVM" | "NGX"): Promise<IndexSheetBundle | null> {
  const row = await prisma.marketIndex.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, code: true, name: true, exchange: true },
  });
  if (!row || row.exchange !== exchange) return null;

  const [points, meta, storedComposition] = await Promise.all([
    prisma.$queryRaw<Array<{ date: Date; value: unknown }>>(composedIndexSeriesSql(row.id)),
    prisma.$queryRaw<
      Array<{
        n: number | null;
        first_d: Date | null;
        ath_v: unknown;
        ath_d: Date | null;
        last_chg: unknown;
        last_src: string | null;
      }>
    >`
      SELECT
        (SELECT count(DISTINCT date)::int FROM market_index_values
           WHERE market_index_id = ${row.id} AND is_canonical = true AND date <= CURRENT_DATE) AS n,
        (SELECT min(date) FROM market_index_values
           WHERE market_index_id = ${row.id} AND is_canonical = true AND date <= CURRENT_DATE) AS first_d,
        a.value AS ath_v, a.date AS ath_d,
        l.change_percent AS last_chg, l.source::text AS last_src
      FROM (SELECT 1) one
      LEFT JOIN LATERAL (
        SELECT value, date FROM market_index_values
        WHERE market_index_id = ${row.id} AND is_canonical = true AND date <= CURRENT_DATE
        ORDER BY value DESC, date DESC LIMIT 1
      ) a ON true
      LEFT JOIN LATERAL (
        SELECT change_percent, source FROM market_index_values
        WHERE market_index_id = ${row.id} AND is_canonical = true AND date <= CURRENT_DATE
        ORDER BY date DESC, created_at DESC LIMIT 1
      ) l ON true
    `,
    exchange === "BRVM" ? loadStoredComposition(row.id) : Promise.resolve(null),
  ]);

  const series = points
    .map((p) => ({ time: iso(p.date), value: num(p.value) ?? NaN }))
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const m = meta[0];

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    exchange,
    series,
    historyPoints: m?.n ?? series.length,
    firstDate: m?.first_d ? iso(m.first_d) : (series[0]?.time ?? null),
    athValue: num(m?.ath_v),
    athDate: m?.ath_d ? iso(m.ath_d) : null,
    lastChangePercent: num(m?.last_chg),
    lastSource: m?.last_src ?? null,
    storedComposition,
  };
}

/** Fiche d'indice (cache 1 h, invalidé après ingestion). null = indice inconnu sur cette place. */
export const loadIndexSheetBundle: (code: string, exchange: "BRVM" | "NGX") => Promise<IndexSheetBundle | null> =
  cachedLoader(loadIndexSheetBundleUncached, ["index-sheet-v1"], {
    revalidate: MARKET_INDICES_REVALIDATE_S,
    tags: [MARKET_INDICES_TAG],
  });

export interface ConstituentMove {
  ticker: string;
  name: string;
  /** Secteur interne (BRVM : nom du secteur ; NGX : slug). */
  sector: string;
  /** NGX : marché (main-board, premium-board…), sinon null. */
  board: string | null;
  close: number | null;
  changePercent: number | null;
  sessionDate: string | null;
}

async function loadBrvmMovesUncached(): Promise<ConstituentMove[]> {
  // 2 dernières clôtures par société (LATERAL … LIMIT 2) : ≈ 96 lignes, ≈ 4 ko.
  const rows = await prisma.$queryRaw<
    Array<{ ticker: string; name: string; sector: string; date: Date; close_price: unknown; change_percent: unknown }>
  >`
    SELECT c.ticker, c.name, s.name AS sector, p.date, p.close_price, p.change_percent
    FROM companies c
    JOIN sectors s ON s.id = c.sector_id
    CROSS JOIN LATERAL (
      SELECT ph.date, ph.close_price, ph.change_percent
      FROM price_history ph
      WHERE ph.company_id = c.id AND ph.is_canonical = true AND ph.date <= CURRENT_DATE
      ORDER BY ph.date DESC
      LIMIT 2
    ) p
    WHERE c.exchange = 'BRVM' AND c.is_active = true
  `;
  const byTicker = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byTicker.get(r.ticker) ?? [];
    list.push(r);
    byTicker.set(r.ticker, list);
  }
  const out: ConstituentMove[] = [];
  for (const [ticker, list] of byTicker) {
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = list[0]!;
    const close = num(latest.close_price);
    const prev = list[1] ? num(list[1].close_price) : null;
    const published = num(latest.change_percent);
    const changePercent =
      published != null
        ? Math.round(published * 100) / 100
        : close != null && prev != null && prev > 0
          ? Math.round(((close - prev) / prev) * 10000) / 100
          : null;
    out.push({
      ticker,
      name: latest.name,
      sector: latest.sector,
      board: null,
      close: close != null && close > 0 ? close : null,
      changePercent,
      sessionDate: iso(latest.date),
    });
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** Variations du jour des valeurs BRVM (cache 1 h, invalidé après ingestion). */
export const loadBrvmConstituentMoves: () => Promise<ConstituentMove[]> = cachedLoader(
  loadBrvmMovesUncached,
  ["brvm-constituent-moves-v1"],
  { revalidate: MARKET_INDICES_REVALIDATE_S, tags: [MARKET_INDICES_TAG] }
);
