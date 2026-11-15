// Dernières lignes canoniques par société / par indice, calculées par PostgreSQL.
//
// Pourquoi : Prisma 5 applique `take` sur une relation imbriquée (ex.
// `priceHistory: { take: 1 }` sous `company.findMany`) et `distinct` EN MÉMOIRE,
// côté Node. PostgreSQL renvoie donc tout l'historique de chaque société
// (≈ 136 000 lignes pour le seul univers NGX) avant que Node n'en garde une
// ou deux. Ce trafic sortant (egress) est facturé par Supabase.
//
// Ici, `LATERAL … LIMIT n` (index price_history(company_id, date)) ne sélectionne
// que les identifiants utiles ; Prisma relit ensuite ces seules lignes par clé
// primaire, avec exactement le même typage qu'avant (Decimal, BigInt, enums).
// Sémantique identique à l'ancien code : filtre `is_canonical = true`, tri par
// date décroissante, mêmes bornes de date facultatives.

import { Prisma } from "@prisma/client";
import type { MarketIndexValue, PriceHistory, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "$queryRaw" | "priceHistory" | "marketIndexValue">;

export interface LatestCanonicalOptions {
  /** Nombre de lignes par société (1 = dernier cours, 2 = dernier + précédent). */
  limit?: number;
  /** Ne garder que les séances `date <= jour UTC de onOrBefore` (équivaut à Prisma `date: { lte }`). */
  onOrBefore?: Date;
  /** Ne garder que les séances `date < jour UTC de before` (équivaut à Prisma `date: { lt }` sur une date minuit UTC). */
  before?: Date;
}

const MAX_LIMIT = 50;

/** Jour calendaire UTC `YYYY-MM-DD` (les colonnes `date` sont de type DATE). */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function clampLimit(limit: number | undefined): number {
  const n = Math.trunc(Number(limit ?? 1));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LIMIT);
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
}

/** Bornes de date facultatives : `date <= jour` et/ou `date < jour` (jours UTC). */
function dateBounds(alias: string, opts: LatestCanonicalOptions): Prisma.Sql {
  const col = Prisma.raw(`${alias}.date`);
  const parts: Prisma.Sql[] = [];
  if (opts.onOrBefore) parts.push(Prisma.sql`AND ${col} <= ${utcDay(opts.onOrBefore)}::date`);
  if (opts.before) parts.push(Prisma.sql`AND ${col} < ${utcDay(opts.before)}::date`);
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

/** SQL : identifiants des `limit` dernières lignes canoniques de chaque société. */
export function latestCanonicalPriceIdsSql(companyIds: readonly string[], opts: LatestCanonicalOptions = {}): Prisma.Sql {
  const limit = clampLimit(opts.limit);
  return Prisma.sql`
    SELECT p.id
    FROM unnest(${uniqueIds(companyIds)}::text[]) AS c(id)
    CROSS JOIN LATERAL (
      SELECT ph.id
      FROM price_history ph
      WHERE ph.company_id = c.id
        AND ph.is_canonical = true
        ${dateBounds("ph", opts)}
      ORDER BY ph.date DESC
      LIMIT ${limit}
    ) p
  `;
}

/** SQL : identifiants des `limit` dernières valeurs canoniques de chaque indice. */
export function latestCanonicalIndexValueIdsSql(indexIds: readonly string[], opts: LatestCanonicalOptions = {}): Prisma.Sql {
  const limit = clampLimit(opts.limit);
  return Prisma.sql`
    SELECT v.id
    FROM unnest(${uniqueIds(indexIds)}::text[]) AS i(id)
    CROSS JOIN LATERAL (
      SELECT miv.id
      FROM market_index_values miv
      WHERE miv.market_index_id = i.id
        AND miv.is_canonical = true
        ${dateBounds("miv", opts)}
      ORDER BY miv.date DESC
      LIMIT ${limit}
    ) v
  `;
}

/** SQL : identifiant de la dernière ligne canonique de chaque (société, année civile). */
export function yearEndCanonicalPriceIdsSql(companyIds: readonly string[], opts: Pick<LatestCanonicalOptions, "onOrBefore"> = {}): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT ON (ph.company_id, EXTRACT(YEAR FROM ph.date)) ph.id
    FROM price_history ph
    WHERE ph.company_id = ANY(${uniqueIds(companyIds)}::text[])
      AND ph.is_canonical = true
      ${dateBounds("ph", opts)}
    ORDER BY ph.company_id, EXTRACT(YEAR FROM ph.date), ph.date DESC
  `;
}

/** Regroupe des lignes par clé, chaque groupe trié par date décroissante (comme `orderBy: { date: "desc" }`). */
export function groupByKeyDateDesc<T extends { date: Date }>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  for (const list of out.values()) list.sort((a, b) => b.date.getTime() - a.date.getTime());
  return out;
}

async function idsOf(db: Db, sql: Prisma.Sql): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>(sql);
  return rows.map((r) => r.id);
}

/**
 * `limit` dernières lignes canoniques `price_history` par société (date décroissante).
 * Société sans cours : absente de la Map.
 */
export async function loadLatestCanonicalPrices(
  db: Db,
  companyIds: readonly string[],
  opts: LatestCanonicalOptions = {}
): Promise<Map<string, PriceHistory[]>> {
  if (uniqueIds(companyIds).length === 0) return new Map();
  const ids = await idsOf(db, latestCanonicalPriceIdsSql(companyIds, opts));
  if (ids.length === 0) return new Map();
  const rows = await db.priceHistory.findMany({ where: { id: { in: ids } } });
  return groupByKeyDateDesc(rows, (r) => r.companyId);
}

/** Dernière ligne canonique par société (raccourci de `loadLatestCanonicalPrices`, limit 1). */
export async function loadLatestCanonicalPrice(
  db: Db,
  companyIds: readonly string[],
  opts: Omit<LatestCanonicalOptions, "limit"> = {}
): Promise<Map<string, PriceHistory>> {
  const grouped = await loadLatestCanonicalPrices(db, companyIds, { ...opts, limit: 1 });
  return new Map([...grouped].map(([id, rows]) => [id, rows[0]]));
}

/** `limit` dernières valeurs canoniques `market_index_values` par indice (date décroissante). */
export async function loadLatestCanonicalIndexValues(
  db: Db,
  indexIds: readonly string[],
  opts: LatestCanonicalOptions = {}
): Promise<Map<string, MarketIndexValue[]>> {
  if (uniqueIds(indexIds).length === 0) return new Map();
  const ids = await idsOf(db, latestCanonicalIndexValueIdsSql(indexIds, opts));
  if (ids.length === 0) return new Map();
  const rows = await db.marketIndexValue.findMany({ where: { id: { in: ids } } });
  return groupByKeyDateDesc(rows, (r) => r.marketIndexId);
}

/** Dernière ligne canonique de chaque (société, année civile), non future si `onOrBefore`. */
export async function loadYearEndCanonicalPrices(
  db: Db,
  companyIds: readonly string[],
  opts: Pick<LatestCanonicalOptions, "onOrBefore"> = {}
): Promise<PriceHistory[]> {
  if (uniqueIds(companyIds).length === 0) return [];
  const ids = await idsOf(db, yearEndCanonicalPriceIdsSql(companyIds, opts));
  if (ids.length === 0) return [];
  return db.priceHistory.findMany({ where: { id: { in: ids } } });
}
