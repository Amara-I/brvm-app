// ═══════════════════════════════════════════════════════════════════════════
// Persistance des résultats d'ingestion — étape 6 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Toutes les fonctions ci-dessous sont volontairement de simples fonctions
// Prisma paramétrées par le client (plutôt que d'importer le singleton
// `lib/prisma.ts` directement) : cela permet de les appeler aussi bien
// depuis l'orchestrateur (`run-full-ingestion.ts`) que depuis un futur test
// d'intégration avec une base de test dédiée.
//
// Principe de persistance (cf. AGENTS.md § priorité des sources) :
//   1. CHAQUE cotation brute (peu importe la source) est upsertée telle
//      quelle dans `price_history`/`market_index_values`, avec sa propre
//      ligne (clé unique companyId+date+source). Rien n'est perdu : même
//      les valeurs non retenues restent consultables pour audit.
//   2. La ligne correspondant à la source retenue par la réconciliation
//      (cf. reconciliation.ts) est ensuite marquée `isCanonical = true`,
//      après avoir démoté toute ancienne ligne canonique pour ce
//      (société, date) — garantit l'invariant "au plus une ligne canonique
//      par (société, date)" même si la source gagnante change d'un jour à
//      l'autre (ex: BRVM.org publie en retard un jour donné).
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { toPrismaDataSource } from "./prisma-mappers";
import type { DiscrepancyReport, ReconciledIndex, ReconciledPrice } from "./reconciliation";
import { canonicalRowsForPersist, canonicalSourceForDay, sourceOutranks } from "./reconciliation";
import { filterCanonicalByCollar, getCollarConfig } from "./price-collar";
import { priceDivisor } from "@/lib/corporate-actions/adjust";
import { loadCorporateActions } from "@/lib/corporate-actions/load";
import { isMissingDatabaseObject } from "../db/is-database-unavailable";
import type {
  DataSourceCode,
  RawCompanyDocument,
  RawCompanyEventItem,
  RawCompanyFundamentals,
  RawCompanyNewsItem,
  RawCompanyProfile,
  RawDividendRow,
  RawIndexConstituent,
  RawIndexQuote,
  RawPriceQuote,
} from "./types";

type ProfileMetaJson = {
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  directors?: string | null;
  ceo?: string | null;
  chairman?: string | null;
  industry?: string | null;
  website?: string | null;
  listingDate?: string | null;
  sharesOutstanding?: number | null;
  floatPercent?: number | null;
  valuationLabel?: string | null;
  shareholders?: Array<{ name: string; percent: number | null }>;
  shareholdersAsOf?: string | null;
  source?: string;
  fetchedAt?: string;
};

function pickStr(next: string | null | undefined, prev: string | null | undefined): string | null {
  const n = next?.trim() || null;
  const p = prev?.trim() || null;
  if (n && n.length >= (p?.length ?? 0)) return n;
  return n ?? p;
}

function pickNum(next: number | null | undefined, prev: number | null | undefined): number | null {
  if (next != null && Number.isFinite(next)) return next;
  if (prev != null && Number.isFinite(prev)) return prev;
  return null;
}

function mergeShareholders(
  next: Array<{ name: string; percent: number | null }> | undefined,
  prev: Array<{ name: string; percent: number | null }> | undefined
): Array<{ name: string; percent: number | null }> {
  const a = next ?? [];
  const b = prev ?? [];
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const sum = (xs: typeof a) =>
    xs.reduce((s, x) => s + (x.percent != null && Number.isFinite(x.percent) ? x.percent : 0), 0);
  // Préférer le jeu le plus complet (plus d'entrées, sinon somme plus proche de 100).
  if (a.length !== b.length) return a.length > b.length ? a : b;
  return Math.abs(100 - sum(a)) <= Math.abs(100 - sum(b)) ? a : b;
}

export interface PersistPricesResult {
  upserted: number;
  markedCanonical: number;
  unknownTickers: string[];
  collarRejected: number;
}

const PRICE_UPSERT_CHUNK = 400;
/// Paires (société, date) traitées par requête pour le marquage canonique et
/// la recherche du cours précédent : 2-3 paramètres par paire, bien sous la
/// limite de 65 535 paramètres de Postgres.
const CANONICAL_BATCH_PAIRS = 500;

/// Un seul INSERT … ON CONFLICT par lot (le pooler Supabase :6543 facture
/// chaque aller-retour). Repli ligne à ligne si le SQL groupé est refusé.
async function bulkUpsertPriceHistory(
  db: PrismaClient,
  rows: Array<{
    companyId: string;
    date: Date;
    source: string;
    closePrice: number;
    volume: bigint | null;
    changePercent: number | null;
  }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += PRICE_UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + PRICE_UPSERT_CHUNK);
    const values = chunk.map(
      (r) =>
        Prisma.sql`(
          ${randomUUID()},
          ${r.companyId},
          ${r.date}::date,
          CAST(${r.source} AS "data_source"),
          ${r.closePrice}::numeric,
          ${r.volume}::bigint,
          ${r.changePercent}::numeric
        )`
    );
    await db.$executeRaw`
      INSERT INTO "price_history" (
        "id", "company_id", "date", "source", "close_price", "volume", "change_percent"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("company_id", "date", "source") DO UPDATE SET
        "close_price" = EXCLUDED."close_price",
        "volume" = EXCLUDED."volume",
        "change_percent" = COALESCE(EXCLUDED."change_percent", "price_history"."change_percent"),
        "ingested_at" = CURRENT_TIMESTAMP
    `;
  }
}

export interface CanonicalPair {
  companyId: string;
  /** YYYY-MM-DD */
  date: string;
}

export interface CanonicalWinner extends CanonicalPair {
  source: DataSourceCode;
}

/// Pure : pour chaque (société, date) demandé, la source gagnante parmi les
/// lignes déjà en base — même règle que `canonicalSourceForDay` (BRVM_OFFICIEL
/// d'abord, puis NGX_OFFICIEL, SIKAFINANCE, OUESTBOURSE, RICHBOURSE, MANUEL).
export function pickCanonicalWinners(
  wanted: CanonicalPair[],
  existing: Array<{ companyId: string; date: string; source: string }>
): CanonicalWinner[] {
  const sourcesByKey = new Map<string, DataSourceCode[]>();
  for (const row of existing) {
    const key = `${row.companyId}__${row.date.slice(0, 10)}`;
    const list = sourcesByKey.get(key) ?? [];
    list.push(row.source as DataSourceCode);
    sourcesByKey.set(key, list);
  }
  const winners: CanonicalWinner[] = [];
  const seen = new Set<string>();
  for (const pair of wanted) {
    const key = `${pair.companyId}__${pair.date.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const winner = canonicalSourceForDay(sourcesByKey.get(key) ?? []);
    if (!winner) continue;
    winners.push({ companyId: pair.companyId, date: pair.date.slice(0, 10), source: winner });
  }
  return winners;
}

/// Marque la ligne canonique de chaque (société, date) par lots : une lecture
/// des sources présentes puis un seul UPDATE qui remet `is_canonical` à
/// `source = gagnante` pour tout le jour (invariant : au plus un canonique par
/// société et date). Remplace 4 requêtes par ticker.
export async function markCanonicalPriceRows(db: PrismaClient, pairs: CanonicalPair[]): Promise<number> {
  const unique = new Map<string, CanonicalPair>();
  for (const pair of pairs) unique.set(`${pair.companyId}__${pair.date.slice(0, 10)}`, { companyId: pair.companyId, date: pair.date.slice(0, 10) });
  const all = [...unique.values()];
  let marked = 0;
  for (let i = 0; i < all.length; i += CANONICAL_BATCH_PAIRS) {
    const chunk = all.slice(i, i + CANONICAL_BATCH_PAIRS);
    const wantedValues = chunk.map((p) => Prisma.sql`(${p.companyId}::text, ${p.date}::date)`);
    const existing = await db.$queryRaw<Array<{ companyId: string; date: string; source: string }>>`
      SELECT ph."company_id" AS "companyId", ph."date"::text AS "date", ph."source"::text AS "source"
      FROM "price_history" AS ph
      JOIN (VALUES ${Prisma.join(wantedValues)}) AS v("company_id", "date")
        ON ph."company_id" = v."company_id" AND ph."date" = v."date"
    `;
    const winners = pickCanonicalWinners(chunk, existing);
    if (winners.length === 0) continue;
    const winnerValues = winners.map(
      (w) => Prisma.sql`(${w.companyId}::text, ${w.date}::date, CAST(${w.source} AS "data_source"))`
    );
    await db.$executeRaw`
      UPDATE "price_history" AS ph
      SET "is_canonical" = (ph."source" = v."source")
      FROM (VALUES ${Prisma.join(winnerValues)}) AS v("company_id", "date", "source")
      WHERE ph."company_id" = v."company_id"
        AND ph."date" = v."date"
        AND ph."is_canonical" IS DISTINCT FROM (ph."source" = v."source")
    `;
    marked += winners.length;
  }
  return marked;
}

/// Dernier cours canonique strictement avant `minDate`, par société : une
/// seule requête (LATERAL) par lot au lieu d'un `findFirst` par ticker.
export async function loadPreviousCanonicalCloses(
  db: PrismaClient,
  lookups: Array<{ ticker: string; companyId: string; minDate: string }>
): Promise<Map<string, { date: string; closePrice: number }>> {
  const out = new Map<string, { date: string; closePrice: number }>();
  for (let i = 0; i < lookups.length; i += CANONICAL_BATCH_PAIRS) {
    const chunk = lookups.slice(i, i + CANONICAL_BATCH_PAIRS);
    const values = chunk.map((l) => Prisma.sql`(${l.companyId}::text, ${l.minDate.slice(0, 10)}::date)`);
    const rows = await db.$queryRaw<Array<{ companyId: string; date: string; closePrice: number }>>`
      SELECT v."company_id" AS "companyId", prev."date"::text AS "date", prev."close_price"::float8 AS "closePrice"
      FROM (VALUES ${Prisma.join(values)}) AS v("company_id", "min_date")
      CROSS JOIN LATERAL (
        SELECT ph."date", ph."close_price"
        FROM "price_history" AS ph
        WHERE ph."company_id" = v."company_id"
          AND ph."is_canonical" = true
          AND ph."date" < v."min_date"
        ORDER BY ph."date" DESC
        LIMIT 1
      ) AS prev
    `;
    const tickerByCompany = new Map(chunk.map((l) => [l.companyId, l.ticker]));
    for (const row of rows) {
      const ticker = tickerByCompany.get(row.companyId);
      if (ticker) out.set(ticker, { date: row.date.slice(0, 10), closePrice: Number(row.closePrice) });
    }
  }
  return out;
}

/// Upserte toutes les cotations brutes (`price_history`), puis marque la
/// valeur canonique retenue par la réconciliation. `companyIdByTicker` doit
/// couvrir tous les tickers actifs — un ticker inconnu (ex: nouvelle
/// introduction en bourse pas encore seedée) est ignoré et remonté dans
/// `unknownTickers` plutôt que de faire échouer tout le run.
export async function persistPriceQuotes(
  db: PrismaClient,
  allQuotes: RawPriceQuote[],
  reconciled: ReconciledPrice[],
  companyIdByTicker: Map<string, string>,
  options?: {
    /** Défaut : collier BRVM ±7,5 %. La NGX passe `collarConfigForExchange("NGX")`. */
    collar?: ReturnType<typeof getCollarConfig>;
    collarLabel?: string;
  }
): Promise<PersistPricesResult> {
  const unknownTickers = new Set<string>();
  let upserted = 0;
  const pending: Array<{
    companyId: string;
    date: Date;
    source: ReturnType<typeof toPrismaDataSource>;
    closePrice: number;
    volume: bigint | null;
    changePercent: number | null;
  }> = [];

  for (const q of allQuotes) {
    const companyId = companyIdByTicker.get(q.ticker);
    if (!companyId) {
      unknownTickers.add(q.ticker);
      continue;
    }
    pending.push({
      companyId,
      date: new Date(`${q.date}T00:00:00.000Z`),
      source: toPrismaDataSource(q.source),
      closePrice: q.closePrice,
      volume: q.volume !== null ? BigInt(Math.round(q.volume)) : null,
      changePercent: q.changePercent ?? null,
    });
  }

  if (pending.length > 0) {
    try {
      await bulkUpsertPriceHistory(db, pending);
      upserted = pending.length;
    } catch (err) {
      console.warn(
        `[ingest] upsert groupé price_history indisponible (${err instanceof Error ? err.message : String(err)}) — repli ligne à ligne`
      );
      for (const row of pending) {
        await db.priceHistory.upsert({
          where: { uniq_price_company_date_source: { companyId: row.companyId, date: row.date, source: row.source } },
          update: {
            closePrice: row.closePrice,
            volume: row.volume,
            ...(row.changePercent != null ? { changePercent: row.changePercent } : {}),
            ingestedAt: new Date(),
          },
          create: {
            companyId: row.companyId,
            date: row.date,
            source: row.source,
            closePrice: row.closePrice,
            volume: row.volume,
            changePercent: row.changePercent,
          },
        });
        upserted++;
      }
    }
  }

  const byTicker = new Map<string, ReconciledPrice[]>();
  for (const r of reconciled) {
    const arr = byTicker.get(r.ticker) ?? [];
    arr.push(r);
    byTicker.set(r.ticker, arr);
  }

  const previousByTicker = new Map<string, { date: string; closePrice: number }>();
  const previousLookups: Array<{ ticker: string; companyId: string; minDate: string }> = [];
  for (const [ticker, rows] of byTicker) {
    const companyId = companyIdByTicker.get(ticker);
    if (!companyId || rows.length === 0) continue;
    const minDate = rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0]!.date);
    previousLookups.push({ ticker, companyId, minDate });
  }
  try {
    const previous = await loadPreviousCanonicalCloses(db, previousLookups);
    for (const [ticker, prev] of previous) previousByTicker.set(ticker.toUpperCase(), prev);
  } catch {
    /* table absente / hors ligne — collier appliqué sans précédent DB */
  }

  const actionsBySymbol = new Map<string, Awaited<ReturnType<typeof loadCorporateActions>>>();
  try {
    for (const action of await loadCorporateActions()) {
      const list = actionsBySymbol.get(action.ticker) ?? [];
      list.push(action);
      actionsBySymbol.set(action.ticker, list);
    }
  } catch {
    /* catalogue indisponible — collier sur les cours bruts */
  }

  const collar = filterCanonicalByCollar(reconciled, {
    previousByTicker,
    rawQuotes: allQuotes,
    config: options?.collar,
    priceDivisor: (ticker, date) => priceDivisor(actionsBySymbol.get(ticker.toUpperCase()) ?? [], date),
  });
  if (collar.rejected.length > 0) {
    console.warn(
      `[collar] ${collar.rejected.length} cours hors collier ${options?.collarLabel ?? "BRVM (~±7,5 %)"} — écart journalisé, séance quand même canonique. Ex. ` +
        collar.rejected
          .slice(0, 4)
          .map((r) => `${r.ticker} ${r.date}: ${r.previousClose}→${r.closePrice} (${r.deltaPercent}%)`)
          .join(" | ")
    );
    const reports: DiscrepancyReport[] = collar.rejected.map((r) => ({
      ticker: r.ticker,
      date: r.date,
      field: "close_price_collar",
      brvmValue: r.resolvedSource === "BRVM_OFFICIEL" ? r.closePrice : r.previousClose,
      sikaValue: r.resolvedSource === "SIKAFINANCE" ? r.closePrice : null,
      richValue: r.resolvedSource === "RICHBOURSE" ? r.closePrice : null,
      deltaPercent: Math.abs(r.deltaPercent),
    }));
    try {
      await persistDiscrepancies(db, reports, companyIdByTicker, collar.accepted);
    } catch (err) {
      console.warn(
        `[collar] journalisation data_discrepancies ignorée : ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Le collier ne retire pas le canonique : chaque séance réconciliée
  // (y compris un écart journalisé) reçoit exactement une ligne canonique.
  const markByTicker = new Map<string, ReconciledPrice[]>();
  for (const r of canonicalRowsForPersist(reconciled)) {
    const arr = markByTicker.get(r.ticker) ?? [];
    arr.push(r);
    markByTicker.set(r.ticker, arr);
  }

  const toMark: CanonicalPair[] = [];
  for (const [ticker, rows] of markByTicker) {
    const companyId = companyIdByTicker.get(ticker);
    if (!companyId) continue;
    for (const r of rows) toMark.push({ companyId, date: r.date.slice(0, 10) });
  }
  const markedCanonical = await markCanonicalPriceRows(db, toMark);

  return {
    upserted,
    markedCanonical,
    unknownTickers: [...unknownTickers],
    collarRejected: collar.rejected.length,
  };
}

export async function persistHistorySkip(
  db: PrismaClient,
  companyId: string,
  reason: string,
  until?: Date | null
): Promise<boolean> {
  try {
    await db.company.update({
      where: { id: companyId },
      data: {
        skipHistoryBackfill: true,
        historySkipReason: reason,
        historySkipUntil: until ?? null,
      },
    });
    return true;
  } catch (err) {
    if (isMissingDatabaseObject(err)) return false;
    throw err;
  }
}

export interface PersistRatiosResult {
  upserted: number;
  markedCanonical: number;
  unknownTickers: string[];
}

/// Upserte les ratios (PER / capitalisation en Mds FCFA) puis marque la
/// ligne BRVM (ou autre source fournie) comme canonique pour l'année.
export async function persistFinancialRatios(
  db: PrismaClient,
  rows: RawCompanyFundamentals[],
  companyIdByTicker: Map<string, string>
): Promise<PersistRatiosResult> {
  const unknownTickers = new Set<string>();
  let upserted = 0;
  let markedCanonical = 0;

  for (const row of rows) {
    if (
      row.per === null &&
      row.mktCapMds === null &&
      row.roe == null &&
      row.netMargin == null &&
      row.revenueGrowth == null &&
      row.revenue == null &&
      row.netIncome == null &&
      row.operatingIncome == null &&
      row.debtRatio == null &&
      row.pbRatio == null &&
      row.fcf == null
    ) {
      continue;
    }
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknownTickers.add(row.ticker);
      continue;
    }
    const source = toPrismaDataSource(row.source);
    const existingCanon = await db.financialRatio.findFirst({
      where: { companyId, year: row.year, isCanonical: true },
      select: { source: true },
    });
    const incomingWins =
      !existingCanon ||
      existingCanon.source === source ||
      sourceOutranks(row.source, existingCanon.source as DataSourceCode);

    await db.financialRatio.upsert({
      where: { uniq_ratio_company_year_source: { companyId, year: row.year, source } },
      update: {
        ...(row.per !== null ? { per: row.per } : {}),
        ...(row.mktCapMds !== null ? { mktCap: row.mktCapMds } : {}),
        ...(row.roe != null ? { roe: row.roe } : {}),
        ...(row.netMargin != null ? { netMargin: row.netMargin } : {}),
        ...(row.revenueGrowth != null ? { revenueGrowth: row.revenueGrowth } : {}),
        ...(row.debtRatio != null ? { debtRatio: row.debtRatio } : {}),
        ...(row.pbRatio != null ? { pbRatio: row.pbRatio } : {}),
        ...(row.fcf != null ? { fcf: row.fcf } : {}),
        isCanonical: incomingWins,
      },
      create: {
        companyId,
        year: row.year,
        source,
        per: row.per,
        mktCap: row.mktCapMds,
        roe: row.roe ?? null,
        netMargin: row.netMargin ?? null,
        revenueGrowth: row.revenueGrowth ?? null,
        debtRatio: row.debtRatio ?? null,
        pbRatio: row.pbRatio ?? null,
        fcf: row.fcf ?? null,
        isCanonical: incomingWins,
      },
    });
    // Comptes annuels (CA / RN / REX) — SQL direct tant que le client Prisma
    // n'est pas régénéré (fichier query_engine souvent verrouillé par next dev).
    if (row.revenue != null || row.netIncome != null || row.operatingIncome != null) {
      await db.$executeRaw`
        UPDATE financial_ratios
        SET
          revenue = COALESCE(${row.revenue ?? null}, revenue),
          net_income = COALESCE(${row.netIncome ?? null}, net_income),
          operating_income = COALESCE(${row.operatingIncome ?? null}, operating_income)
        WHERE company_id = ${companyId}
          AND year = ${row.year}
          AND source = ${source}::data_source
      `;
    }
    upserted++;
    if (incomingWins) {
      await db.financialRatio.updateMany({
        where: { companyId, year: row.year, source: { not: source } },
        data: { isCanonical: false },
      });
      markedCanonical++;
    }
  }

  return { upserted, markedCanonical, unknownTickers: [...unknownTickers] };
}

export interface PersistDividendsResult {
  upserted: number;
  markedCanonical: number;
  unknownTickers: string[];
}

/// Upserte des dividendes annuels. Ne remplace pas un dividende BRVM_OFFICIEL
/// déjà présent pour la même année (priorité source).
export async function persistDividendRows(
  db: PrismaClient,
  rows: RawDividendRow[],
  companyIdByTicker: Map<string, string>
): Promise<PersistDividendsResult> {
  const unknownTickers = new Set<string>();
  let upserted = 0;
  let markedCanonical = 0;

  const toDate = (iso: string | null | undefined) =>
    iso ? new Date(`${iso}T00:00:00.000Z`) : undefined;

  for (const row of rows) {
    if (!(row.amount > 0)) continue;
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknownTickers.add(row.ticker);
      continue;
    }
    const source = toPrismaDataSource(row.source);
    const exDate = toDate(row.exDate);
    const paymentDate = toDate(row.paymentDate);
    const datePayload =
      exDate || paymentDate
        ? {
            ...(exDate ? { exDate } : {}),
            ...(paymentDate ? { paymentDate } : {}),
          }
        : {};

    const hasBrvm = await db.dividend.findFirst({
      where: { companyId, year: row.year, source: "BRVM_OFFICIEL" },
      select: { id: true },
    });
    if (hasBrvm && source !== "BRVM_OFFICIEL") {
      // Conserve la ligne BRVM ; stocke quand même Sika pour audit si besoin.
      await db.dividend.upsert({
        where: { uniq_dividend_company_year_source: { companyId, year: row.year, source } },
        update: { amount: row.amount },
        create: { companyId, year: row.year, amount: row.amount, source, isCanonical: false },
      });
      upserted++;
      continue;
    }
    await db.dividend.upsert({
      where: { uniq_dividend_company_year_source: { companyId, year: row.year, source } },
      update: { amount: row.amount, isCanonical: true, ...datePayload },
      create: {
        companyId,
        year: row.year,
        amount: row.amount,
        source,
        isCanonical: true,
        ...datePayload,
      },
    });
    upserted++;
    await db.dividend.updateMany({
      where: { companyId, year: row.year, source: { not: source } },
      data: { isCanonical: false },
    });
    markedCanonical++;
  }

  return { upserted, markedCanonical, unknownTickers: [...unknownTickers] };
}

/** Applique les dates de détachement Sikafinance (calendrier à venir) sur les lignes canoniques. */
export async function applySikaUpcomingDividendDates(
  db: PrismaClient,
  rows: RawDividendRow[],
  companyIdByTicker: Map<string, string>
): Promise<number> {
  let updated = 0;
  for (const row of rows) {
    if (!row.exDate) continue;
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) continue;
    const candidates = await db.dividend.findMany({
      where: { companyId, isCanonical: true, amount: { gt: 0 } },
      orderBy: { year: "desc" },
      take: 6,
    });
    const match = candidates.find((c) => {
      const amt = Number(c.amount);
      return Math.abs(amt - row.amount) <= Math.max(1, row.amount * 0.02);
    });
    if (!match || match.exDate) continue;
    await db.dividend.update({
      where: { id: match.id },
      data: { exDate: new Date(`${row.exDate}T00:00:00.000Z`) },
    });
    updated++;
  }
  return updated;
}

export interface PersistRichbourseCalendarResult {
  upserted: number;
  markedCanonical: number;
  unknownTickers: string[];
}

/// Dividendes « année civile » Richbourse — remplace les placeholders MANUEL (ex. 2026).
/// Ne remplace pas une ligne BRVM_OFFICIEL déjà canonique pour la même année.
export async function persistRichbourseCalendarDividends(
  db: PrismaClient,
  rows: RawDividendRow[],
  companyIdByTicker: Map<string, string>
): Promise<PersistRichbourseCalendarResult> {
  const unknownTickers = new Set<string>();
  let upserted = 0;
  let markedCanonical = 0;

  const toDate = (iso: string | null | undefined) =>
    iso ? new Date(`${iso}T00:00:00.000Z`) : undefined;

  for (const row of rows) {
    if (!(row.amount > 0)) continue;
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknownTickers.add(row.ticker);
      continue;
    }

    const brvmCanonical = await db.dividend.findFirst({
      where: {
        companyId,
        year: row.year,
        source: "BRVM_OFFICIEL",
        isCanonical: true,
      },
      select: { id: true, exDate: true, paymentDate: true },
    });
    if (brvmCanonical?.exDate || brvmCanonical?.paymentDate) continue;

    const exDate = toDate(row.exDate);
    const paymentDate = toDate(row.paymentDate);
    const datePayload =
      exDate || paymentDate
        ? {
            ...(exDate ? { exDate } : {}),
            ...(paymentDate ? { paymentDate } : {}),
          }
        : {};

    await db.dividend.upsert({
      where: {
        uniq_dividend_company_year_source: { companyId, year: row.year, source: "RICHBOURSE" },
      },
      update: { amount: row.amount, isCanonical: true, ...datePayload },
      create: {
        companyId,
        year: row.year,
        amount: row.amount,
        source: "RICHBOURSE",
        isCanonical: true,
        ...datePayload,
      },
    });
    upserted++;
    await db.dividend.updateMany({
      where: { companyId, year: row.year, source: { not: "RICHBOURSE" } },
      data: { isCanonical: false },
    });
    markedCanonical++;
  }

  return { upserted, markedCanonical, unknownTickers: [...unknownTickers] };
}

export interface PersistProfilesResult {
  updated: number;
  unknownTickers: string[];
}

/// Met à jour ISIN / description / profileMeta en fusionnant (ne jamais
/// écraser une valeur déjà renseignée par une source plus complète).
export async function persistCompanyProfiles(
  db: PrismaClient,
  rows: RawCompanyProfile[],
  companyIdByTicker: Map<string, string>
): Promise<PersistProfilesResult> {
  const unknownTickers = new Set<string>();
  let updated = 0;

  for (const row of rows) {
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknownTickers.add(row.ticker);
      continue;
    }
    const existing = await db.company.findUnique({
      where: { id: companyId },
      select: { isin: true, description: true, listedSince: true, profileMeta: true },
    });
    if (!existing) continue;

    const prev = (existing.profileMeta as ProfileMetaJson | null) ?? {};
    const listingDate = pickStr(row.listingDate ?? null, prev.listingDate) ?? null;
    const profileMeta: ProfileMetaJson = {
      phone: pickStr(row.phone, prev.phone),
      fax: pickStr(row.fax, prev.fax),
      address: pickStr(row.address, prev.address),
      directors: pickStr(row.directors, prev.directors),
      ceo: pickStr(row.ceo ?? null, prev.ceo),
      chairman: pickStr(row.chairman ?? null, prev.chairman),
      industry: pickStr(row.industry ?? null, prev.industry),
      website: pickStr(row.website ?? null, prev.website),
      listingDate,
      sharesOutstanding: pickNum(row.sharesOutstanding, prev.sharesOutstanding),
      floatPercent: pickNum(row.floatPercent, prev.floatPercent),
      valuationLabel: pickStr(row.valuationLabel, prev.valuationLabel),
      shareholders: mergeShareholders(row.shareholders, prev.shareholders),
      shareholdersAsOf: pickStr(row.shareholdersAsOf ?? null, prev.shareholdersAsOf) ?? null,
      source: row.source || prev.source,
      fetchedAt: row.fetchedAt || prev.fetchedAt,
    };

    const data: {
      isin?: string;
      description?: string;
      listedSince?: Date;
      profileMeta?: ProfileMetaJson;
    } = {
      profileMeta,
    };
    if (!existing.isin && row.isin) data.isin = row.isin;
    if ((!existing.description || existing.description.length < 40) && row.description) {
      data.description = row.description.slice(0, 4000);
    }
    if (!existing.listedSince && listingDate && /^\d{4}-\d{2}-\d{2}/.test(listingDate)) {
      const d = new Date(`${listingDate.slice(0, 10)}T12:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) data.listedSince = d;
    }

    try {
      await db.company.update({ where: { id: companyId }, data });
      updated++;
    } catch {
      const { isin: _i, ...rest } = data;
      if (Object.keys(rest).length > 0) {
        await db.company.update({ where: { id: companyId }, data: rest });
        updated++;
      }
    }
  }

  return { updated, unknownTickers: [...unknownTickers] };
}

export interface PersistIndicesResult {
  upserted: number;
  markedCanonical: number;
}

/// Upserte les indices eux-mêmes (`market_indices`, auto-créés au premier
/// passage à partir du libellé source) puis leurs valeurs quotidiennes
/// (`market_index_values`), avec la même logique canonique que les prix.
export async function persistIndexQuotes(
  db: PrismaClient,
  allQuotes: RawIndexQuote[],
  reconciled: ReconciledIndex[]
): Promise<PersistIndicesResult> {
  const labelByCode = new Map<string, string>();
  for (const q of allQuotes) if (!labelByCode.has(q.code)) labelByCode.set(q.code, q.label);

  const indexIdByCode = new Map<string, string>();
  for (const [code, label] of labelByCode) {
    const marketIndex = await db.marketIndex.upsert({ where: { code }, update: {}, create: { code, name: label } });
    indexIdByCode.set(code, marketIndex.id);
  }

  let upserted = 0;
  for (const q of allQuotes) {
    const marketIndexId = indexIdByCode.get(q.code);
    if (!marketIndexId) continue;
    const date = new Date(`${q.date}T00:00:00.000Z`);
    const source = toPrismaDataSource(q.source);
    await db.marketIndexValue.upsert({
      where: { uniq_index_date_source: { marketIndexId, date, source } },
      update: { value: q.value, changePercent: q.changePercent },
      create: { marketIndexId, date, value: q.value, changePercent: q.changePercent, source },
    });
    upserted++;
  }

  let markedCanonical = 0;
  for (const r of reconciled) {
    const marketIndexId = indexIdByCode.get(r.code);
    if (!marketIndexId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const existing = await db.marketIndexValue.findMany({
      where: { marketIndexId, date },
      select: { source: true },
    });
    const winner = canonicalSourceForDay([
      ...existing.map((row) => row.source as DataSourceCode),
      r.resolvedSource,
    ]);
    if (!winner) continue;
    const winningSource = toPrismaDataSource(winner);
    await db.marketIndexValue.updateMany({ where: { marketIndexId, date }, data: { isCanonical: false } });
    await db.marketIndexValue.update({
      where: { uniq_index_date_source: { marketIndexId, date, source: winningSource } },
      data: { isCanonical: true },
    });
    markedCanonical++;
  }

  return { upserted, markedCanonical };
}

/**
 * Séances qui ont au moins une source mais aucune ligne canonique
 * (collier, lot interrompu, source bloquée). On élit la source prioritaire.
 * Postgres uniquement — no-op silencieux si le SQL est refusé.
 */
export async function promotePriceDaysWithoutCanonical(db: PrismaClient, since: Date): Promise<number> {
  const n = await db.$executeRaw`
    UPDATE "price_history" AS ph
    SET "is_canonical" = true
    WHERE ph."id" IN (
      SELECT DISTINCT ON (p."company_id", p."date") p."id"
      FROM "price_history" p
      WHERE p."date" >= ${since}::date
        AND p."date" <= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM "price_history" c
          WHERE c."company_id" = p."company_id"
            AND c."date" = p."date"
            AND c."is_canonical" = true
        )
      ORDER BY p."company_id", p."date",
        CASE p."source"
          WHEN 'BRVM_OFFICIEL' THEN 0
          WHEN 'NGX_OFFICIEL' THEN 1
          WHEN 'SIKAFINANCE' THEN 2
          WHEN 'OUESTBOURSE' THEN 3
          WHEN 'RICHBOURSE' THEN 4
          WHEN 'MANUEL' THEN 5
          ELSE 6
        END,
        p."ingested_at" DESC
    )
  `;
  return typeof n === "number" ? n : 0;
}

export async function promoteIndexDaysWithoutCanonical(db: PrismaClient, since: Date): Promise<number> {
  const n = await db.$executeRaw`
    UPDATE "market_index_values" AS v
    SET "is_canonical" = true
    WHERE v."id" IN (
      SELECT DISTINCT ON (p."market_index_id", p."date") p."id"
      FROM "market_index_values" p
      WHERE p."date" >= ${since}::date
        AND p."date" <= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM "market_index_values" c
          WHERE c."market_index_id" = p."market_index_id"
            AND c."date" = p."date"
            AND c."is_canonical" = true
        )
      ORDER BY p."market_index_id", p."date",
        CASE p."source"
          WHEN 'BRVM_OFFICIEL' THEN 0
          WHEN 'NGX_OFFICIEL' THEN 1
          WHEN 'SIKAFINANCE' THEN 2
          WHEN 'OUESTBOURSE' THEN 3
          WHEN 'RICHBOURSE' THEN 4
          WHEN 'MANUEL' THEN 5
          ELSE 6
        END
    )
  `;
  return typeof n === "number" ? n : 0;
}

export interface PersistIndexConstituentsResult {
  upserted: number;
  indexCodes: string[];
}

/// Remplace le snapshot (indice + source + asOf) par la liste fournie.
export async function persistIndexConstituents(
  db: PrismaClient,
  rows: RawIndexConstituent[]
): Promise<PersistIndexConstituentsResult> {
  const byKey = new Map<string, RawIndexConstituent[]>();
  for (const row of rows) {
    const key = `${row.indexCode}__${row.source}__${row.asOf}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  let upserted = 0;
  const indexCodes = new Set<string>();

  for (const group of byKey.values()) {
    const first = group[0]!;
    const marketIndex = await db.marketIndex.upsert({
      where: { code: first.indexCode },
      update: {},
      create: { code: first.indexCode, name: first.indexCode.replace(/_/g, " ") },
    });
    const asOf = new Date(`${first.asOf}T00:00:00.000Z`);
    const source = toPrismaDataSource(first.source);
    await db.marketIndexConstituent.deleteMany({
      where: { marketIndexId: marketIndex.id, source, asOf },
    });
    for (const row of group) {
      await db.marketIndexConstituent.create({
        data: {
          marketIndexId: marketIndex.id,
          ticker: row.ticker.toUpperCase(),
          weight: row.weight,
          source,
          asOf,
          note: row.note ?? null,
        },
      });
      upserted++;
    }
    indexCodes.add(first.indexCode);
  }

  return { upserted, indexCodes: [...indexCodes] };
}

/// Journalise les écarts > seuil détectés par la réconciliation dans
/// `data_discrepancies`, pour audit manuel (cf. brief). Toujours marqué
/// `resolved: true` / `resolvedBy: null` car la règle de priorité des
/// sources tranche automatiquement — un humain peut rouvrir/contester via
/// l'interface admin (hors périmètre de cette étape) ou le script
/// `scripts/manual-correction.ts` (fallback manuel).
export async function persistDiscrepancies(
  db: PrismaClient,
  discrepancies: DiscrepancyReport[],
  companyIdByTicker: Map<string, string>,
  reconciled: ReconciledPrice[]
): Promise<number> {
  let inserted = 0;
  for (const d of discrepancies) {
    const companyId = companyIdByTicker.get(d.ticker);
    if (!companyId) continue;
    const winner = reconciled.find((r) => r.ticker === d.ticker && r.date === d.date);
    await db.dataDiscrepancy.create({
      data: {
        companyId,
        date: new Date(`${d.date}T00:00:00.000Z`),
        field: d.field,
        brvmValue: d.brvmValue,
        sikaValue: d.sikaValue,
        richValue: d.richValue,
        deltaPercent: d.deltaPercent,
        resolved: true,
        resolvedValue: winner?.closePrice ?? null,
        resolvedSource: winner ? toPrismaDataSource(winner.resolvedSource) : null,
        resolvedBy: null, // null = résolution automatique par la règle de priorité
      },
    });
    inserted++;
  }
  return inserted;
}

function slugFromNewsUrl(url: string, title: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\//, "").replace(/\//g, "-");
    if (path.length > 8) return path.slice(0, 180);
  } catch {
    /* ignore */
  }
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || `news-${Date.now()}`
  );
}

export async function persistCompanyDocuments(
  db: PrismaClient,
  rows: RawCompanyDocument[],
  companyIdByTicker: Map<string, string>
): Promise<{ upserted: number; unknownTickers: string[] }> {
  const unknown = new Set<string>();
  let upserted = 0;
  for (const row of rows) {
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknown.add(row.ticker);
      continue;
    }
    await db.companyDocument.upsert({
      where: { companyId_url: { companyId, url: row.url } },
      create: {
        companyId,
        title: row.title,
        filename: row.filename,
        url: row.url,
        docType: row.docType,
        periodLabel: row.periodLabel,
        publishedAt: row.publishedAt ? new Date(`${row.publishedAt}T00:00:00.000Z`) : null,
        sourceName: row.sourceName,
        externalId: row.externalId,
      },
      update: {
        title: row.title,
        filename: row.filename,
        docType: row.docType,
        periodLabel: row.periodLabel,
        publishedAt: row.publishedAt ? new Date(`${row.publishedAt}T00:00:00.000Z`) : null,
        sourceName: row.sourceName,
        externalId: row.externalId,
      },
    });
    upserted++;
  }
  return { upserted, unknownTickers: [...unknown] };
}

export async function persistCompanyEvents(
  db: PrismaClient,
  rows: RawCompanyEventItem[],
  companyIdByTicker: Map<string, string>
): Promise<{ upserted: number; unknownTickers: string[] }> {
  const unknown = new Set<string>();
  let upserted = 0;
  for (const row of rows) {
    const companyId = companyIdByTicker.get(row.ticker);
    if (!companyId) {
      unknown.add(row.ticker);
      continue;
    }
    const eventDate = new Date(`${row.eventDate}T00:00:00.000Z`);
    if (Number.isNaN(eventDate.getTime())) continue;
    const endDate =
      row.endDate != null ? new Date(`${row.endDate}T00:00:00.000Z`) : null;
    if (endDate && Number.isNaN(endDate.getTime())) continue;
    const title = row.title.slice(0, 500);
    await db.companyEvent.upsert({
      where: {
        companyId_eventDate_title: {
          companyId,
          eventDate,
          title,
        },
      },
      create: {
        companyId,
        title,
        eventDate,
        endDate,
        comment: row.comment,
        sourceName: row.sourceName,
      },
      update: {
        endDate,
        comment: row.comment,
        sourceName: row.sourceName,
      },
    });
    upserted++;
  }
  return { upserted, unknownTickers: [...unknown] };
}

export async function persistCompanyNews(
  db: PrismaClient,
  rows: RawCompanyNewsItem[],
  companyIdByTicker: Map<string, string>
): Promise<{ upserted: number; unknownTickers: string[] }> {
  const unknown = new Set<string>();
  let upserted = 0;
  for (const row of rows) {
    const companyId = companyIdByTicker.get(row.ticker) ?? null;
    if (!companyId) unknown.add(row.ticker);
    const slug = slugFromNewsUrl(row.url, row.title);
    const publishedAt = row.publishedAt
      ? new Date(row.publishedAt)
      : new Date();
    try {
      await db.newsArticle.upsert({
        where: { slug },
        create: {
          title: row.title.slice(0, 500),
          slug,
          summary: row.summary,
          url: row.url,
          sourceName: row.sourceName,
          companyId,
          publishedAt,
        },
        update: {
          title: row.title.slice(0, 500),
          summary: row.summary,
          url: row.url,
          sourceName: row.sourceName,
          companyId: companyId ?? undefined,
        },
      });
      upserted++;
    } catch {
      /* collision slug rare — ignore */
    }
  }
  return { upserted, unknownTickers: [...unknown] };
}
