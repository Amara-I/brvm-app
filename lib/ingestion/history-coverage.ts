// Helpers purs pour densifier l'historique (GetHistos annuel → mensuel →
// journalier chunké). Aucun I/O : testables sans base ni réseau.
//
// Règle : on upsert TOUTES les cotations brutes (audit), mais on ne marque
// canonique que si aucune source plus prioritaire n'existe déjà à cette date
// (BRVM_OFFICIEL > SIKAFINANCE > OUESTBOURSE > RICHBOURSE > MANUEL).

import { sourceOutranks } from "./reconciliation";
import type { ReconciledPrice } from "./reconciliation";
import type { DataSourceCode, RawPriceQuote } from "./types";

/** Fenêtre max journalière GetHistos avant erreur API `toolong`. */
export const DEFAULT_DAILY_CHUNK_DAYS = 89;

/**
 * Nombre min de clôtures déjà en base dans une fenêtre ~89 j pour considérer
 * le chunk « assez dense » et éviter de re-frapper l'API (≈ 60 séances max ;
 * 35 = couverture réelle, pas seulement 1 point annuel au 31/12).
 */
export const DEFAULT_MIN_DAILY_POINTS_PER_CHUNK = 35;

export const DEFAULT_ANNUAL_FROM_YEAR = 1998;

/**
 * Plafond Hobby-safe de fenêtres journalières GetHistos par ticker et par run
 * (≈ 8 × 4,5 s de rate-limit Sika). Le CLI sans budget n'applique pas ce cap.
 */
export const DEFAULT_MAX_DAILY_CHUNKS_PER_RUN = 8;

/** Coût estimé d'une fenêtre GetHistos journalière (rate-limit 3 s + parse). */
export const DAILY_CHUNK_EST_MS = 4_500;

/** Réserve pour fiches / events après le journalier dans le même ticker. */
export const DAILY_SHEETS_RESERVE_MS = 35_000;

/**
 * Seuil forceDaily : ne refetch que les fenêtres à 0 point couvert.
 * ⚠️ Trop bas pour densifier une série mensuelle (~13 pts/an) : ces chunks
 * ont déjà 2–4 dates et seraient sautés. forceDaily garde donc 35 par défaut ;
 * passer minDailyPoints=1 uniquement pour les années 100 % vides.
 */
export const FORCE_DAILY_EMPTY_WINDOW_MIN_POINTS = 1;

export type DailySkipReason =
  | "flag_daily_disabled"
  | "daily_from_off"
  | "no_from_iso"
  | "no_gaps"
  | "time_budget";

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_DAY_RE.test(value);
}

/** Plus petite date YYYY-MM-DD parmi les arguments non nuls. */
export function minIsoDate(...dates: Array<string | null | undefined>): string | null {
  const ok = dates.filter(isIsoDay);
  if (ok.length === 0) return null;
  ok.sort();
  return ok[0] ?? null;
}

export interface IsoRange {
  from: string;
  to: string;
}

export interface ExistingPriceRef {
  date: string; // YYYY-MM-DD
  source: DataSourceCode;
  closePrice: number;
}

export function iterateDailyChunks(
  fromIso: string,
  toIso: string,
  chunkDays = DEFAULT_DAILY_CHUNK_DAYS
): IsoRange[] {
  const start = new Date(`${fromIso}T00:00:00.000Z`);
  const end = new Date(`${toIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const out: IsoRange[] = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    out.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function countDatesInRange(dates: Iterable<string>, from: string, to: string): number {
  let n = 0;
  for (const d of dates) {
    if (d >= from && d <= to) n++;
  }
  return n;
}

export function calendarDaysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Seuil de densité adapté à la longueur réelle de la fenêtre (dernier chunk court). */
export function minDailyPointsForChunk(
  from: string,
  to: string,
  defaultMin = DEFAULT_MIN_DAILY_POINTS_PER_CHUNK
): number {
  const days = calendarDaysInclusive(from, to);
  const approxTrading = Math.floor((days * 5) / 7);
  return Math.min(defaultMin, Math.max(1, approxTrading - 4));
}

/**
 * Retourne les fenêtres encore trop clairsemées (à re-fetcher en journalier).
 * `existingDates` = dates déjà couvertes par une source utilisable (BRVM ou Sika).
 */
export function chunksNeedingFetch(
  chunks: IsoRange[],
  existingDates: Set<string>,
  minPoints = DEFAULT_MIN_DAILY_POINTS_PER_CHUNK
): IsoRange[] {
  return chunks.filter((c) => {
    const need = minDailyPointsForChunk(c.from, c.to, minPoints);
    return countDatesInRange(existingDates, c.from, c.to) < need;
  });
}

export function quotesNeedingUpsert(
  incoming: RawPriceQuote[],
  existing: ExistingPriceRef[]
): RawPriceQuote[] {
  const byDateSource = new Map<string, number>();
  for (const e of existing) {
    byDateSource.set(`${e.date}|${e.source}`, e.closePrice);
  }
  const out: RawPriceQuote[] = [];
  for (const q of incoming) {
    const prev = byDateSource.get(`${q.date}|${q.source}`);
    if (prev != null && prev === q.closePrice) continue;
    out.push(q);
  }
  return out;
}

export function quotesEligibleForCanonical(
  incoming: ReconciledPrice[],
  existing: ExistingPriceRef[]
): ReconciledPrice[] {
  const byDate = new Map<string, DataSourceCode[]>();
  for (const e of existing) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e.source);
    byDate.set(e.date, arr);
  }
  return incoming.filter((r) => {
    const sources = byDate.get(r.date) ?? [];
    return !sources.some((s) => sourceOutranks(s, r.resolvedSource));
  });
}

export function mergeExistingPrices(
  prev: ExistingPriceRef[],
  quotes: RawPriceQuote[]
): ExistingPriceRef[] {
  const map = new Map(prev.map((p) => [`${p.date}|${p.source}`, p] as const));
  for (const q of quotes) {
    map.set(`${q.date}|${q.source}`, {
      date: q.date,
      source: q.source,
      closePrice: q.closePrice,
    });
  }
  return [...map.values()];
}

/** Dates déjà assez « officielles » pour ne pas re-demander du journalier Sika. */
export function coveredDailyDates(existing: ExistingPriceRef[]): Set<string> {
  const s = new Set<string>();
  for (const e of existing) {
    if (e.source === "BRVM_OFFICIEL" || e.source === "SIKAFINANCE") s.add(e.date);
  }
  return s;
}

export function earliestYearFromQuotes(quotes: RawPriceQuote[]): number | null {
  if (quotes.length === 0) return null;
  return Math.min(...quotes.map((q) => Number(q.date.slice(0, 4))));
}

export function earliestIsoFromQuotes(quotes: RawPriceQuote[]): string | null {
  if (quotes.length === 0) return null;
  return [...quotes].map((q) => q.date).sort()[0] ?? null;
}

export function parseIsoDateFlag(raw: string | undefined): string | null {
  if (!raw) return null;
  return ISO_DAY_RE.test(raw) ? raw : null;
}

export function earliestIsoFromExisting(
  existing: ExistingPriceRef[],
  sources?: ReadonlyArray<DataSourceCode>
): string | null {
  const dates = existing
    .filter((e) => !sources || sources.includes(e.source))
    .map((e) => e.date)
    .filter(isIsoDay);
  return minIsoDate(...dates);
}

/**
 * Borne inférieure du journalier.
 *
 * - `dailyFrom=YYYY-MM-DD` : date explicite (pas de clamp listedSince).
 * - `auto` : plus tôt parmi la série Sika fraîchement tirée ET les Sika/BRVM
 *   déjà en base — on ne laisse PAS le mensuel (souvent ~60 derniers mois)
 *   écraser un annuel qui remonte à 2006.
 * - `listedSince` ne relève la borne que s'il n'existe AUCUN cours avant cette
 *   date. Sinon c'est une métadonnée douteuse (ex. date de fiche récente) qui
 *   collapserait la fenêtre sur des mois déjà densifiés par le cron horaire.
 */
export function resolveDailyFromIso(opts: {
  dailyFromOpt?: string | "auto" | "off";
  firstSikaIso?: string | null;
  existing: ExistingPriceRef[];
  listedSinceIso?: string | null;
  annualFromYear?: number;
  /** Si true, `dailyFrom=off` est ignoré (on retombe sur auto). */
  forceDaily?: boolean;
}): string | null {
  const dailyFromOpt = opts.dailyFromOpt;
  if (!opts.forceDaily && (dailyFromOpt === "off" || dailyFromOpt === "false")) return null;
  if (isIsoDay(dailyFromOpt)) return dailyFromOpt;

  const earliestSikaOrBrvm = earliestIsoFromExisting(opts.existing, [
    "SIKAFINANCE",
    "BRVM_OFFICIEL",
  ]);
  let fromIso =
    minIsoDate(opts.firstSikaIso, earliestSikaOrBrvm) ??
    `${opts.annualFromYear ?? DEFAULT_ANNUAL_FROM_YEAR}-01-01`;

  const listed = isIsoDay(opts.listedSinceIso) ? opts.listedSinceIso : null;
  if (listed && listed > fromIso) {
    const hasEvidenceBefore = opts.existing.some((e) => isIsoDay(e.date) && e.date < listed);
    if (!hasEvidenceBefore) fromIso = listed;
  }
  return fromIso;
}

export interface DailyBackfillPlan {
  includeDaily: boolean;
  flagDaily: boolean;
  forceDaily: boolean;
  fromIso: string | null;
  toIso: string;
  skipReason: DailySkipReason | null;
  chunks: IsoRange[];
  gaps: IsoRange[];
  existingPoints: number;
  existingCoveredPoints: number;
  minDailyPoints: number;
}

export function planDailyBackfill(opts: {
  flagDaily: boolean;
  forceDaily?: boolean;
  includeDailyRequested?: boolean;
  dailyFromOpt?: string | "auto" | "off";
  firstSikaIso?: string | null;
  existing: ExistingPriceRef[];
  listedSinceIso?: string | null;
  annualFromYear?: number;
  minDailyPoints?: number;
  todayIso?: string;
}): DailyBackfillPlan {
  const forceDaily = opts.forceDaily === true;
  const flagDaily = opts.flagDaily;
  const requestedOff = opts.includeDailyRequested === false || opts.dailyFromOpt === "off";
  const minDailyPoints = opts.minDailyPoints ?? DEFAULT_MIN_DAILY_POINTS_PER_CHUNK;
  const toIso = opts.todayIso ?? new Date().toISOString().slice(0, 10);
  const existingPoints = opts.existing.length;
  const covered = coveredDailyDates(opts.existing);
  const existingCoveredPoints = covered.size;

  const includeDaily = forceDaily || (!requestedOff && flagDaily && opts.includeDailyRequested !== false);

  const empty = (skipReason: DailySkipReason | null, fromIso: string | null): DailyBackfillPlan => ({
    includeDaily,
    flagDaily,
    forceDaily,
    fromIso,
    toIso,
    skipReason,
    chunks: [],
    gaps: [],
    existingPoints,
    existingCoveredPoints,
    minDailyPoints,
  });

  if (requestedOff && !forceDaily) {
    return empty("daily_from_off", null);
  }
  if (!includeDaily) {
    // Toujours calculer les gaps pour le diagnostic ops, même si on ne fetch pas.
    const fromIso = resolveDailyFromIso(opts);
    if (!fromIso) {
      return empty("flag_daily_disabled", null);
    }
    const chunks = iterateDailyChunks(fromIso, toIso);
    const gaps = chunksNeedingFetch(chunks, covered, minDailyPoints);
    return {
      includeDaily: false,
      flagDaily,
      forceDaily,
      fromIso,
      toIso,
      skipReason: "flag_daily_disabled",
      chunks,
      gaps,
      existingPoints,
      existingCoveredPoints,
      minDailyPoints,
    };
  }

  const fromIso = resolveDailyFromIso(opts);
  if (!fromIso) {
    return empty("no_from_iso", null);
  }
  const chunks = iterateDailyChunks(fromIso, toIso);
  const gaps = chunksNeedingFetch(chunks, covered, minDailyPoints);
  return {
    includeDaily: true,
    flagDaily,
    forceDaily,
    fromIso,
    toIso,
    skipReason: gaps.length === 0 ? "no_gaps" : null,
    chunks,
    gaps,
    existingPoints,
    existingCoveredPoints,
    minDailyPoints,
  };
}

/**
 * Combien de fenêtres journalières on peut réellement frapper dans ce run.
 * `timeLeftMs = Infinity` (CLI sans budget) → pas de plafond temps.
 * Un plafond explicite `maxDailyChunks` s'applique toujours (Hobby-safe).
 */
export function maxDailyChunksThisRun(opts: {
  timeLeftMs: number;
  maxDailyChunks?: number;
  reserveMs?: number;
  chunkEstMs?: number;
  defaultCap?: number;
}): number {
  const est = opts.chunkEstMs ?? DAILY_CHUNK_EST_MS;
  const reserve = opts.reserveMs ?? DAILY_SHEETS_RESERVE_MS;
  const defaultCap = opts.defaultCap ?? DEFAULT_MAX_DAILY_CHUNKS_PER_RUN;
  const explicit =
    opts.maxDailyChunks != null && Number.isFinite(opts.maxDailyChunks)
      ? Math.max(0, Math.floor(opts.maxDailyChunks))
      : null;

  let budgetCap = Number.POSITIVE_INFINITY;
  if (Number.isFinite(opts.timeLeftMs)) {
    const usable = opts.timeLeftMs - reserve;
    if (usable < est) {
      budgetCap = opts.timeLeftMs >= 20_000 ? 1 : 0;
    } else {
      budgetCap = Math.floor(usable / est);
    }
  }

  const cap = explicit ?? (Number.isFinite(opts.timeLeftMs) ? defaultCap : Number.POSITIVE_INFINITY);
  const n = Math.min(budgetCap, cap);
  return Number.isFinite(n) ? Math.max(0, n) : Number.POSITIVE_INFINITY;
}
