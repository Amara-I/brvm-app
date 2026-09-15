// Denylist maintenable pour les tickers Sikafinance « nodata » / fenêtres mortes.
// Ne pas coder en dur uniquement la liste ops : seed + colonne Company + env.

export const SIKA_NODATA_REASON = "sika_nodata";

/** Tickers ops connus (Sika GetHistos `nodata`) — seed / migration, pas une liste fermée. */
export const DEFAULT_SIKA_NODATA_TICKERS: readonly string[] = [
  "NEIC",
  "PRSC",
  "SEMC",
  "SICC",
  "SPHC",
  "STAC",
  "UNLC",
  "UNXC",
];

function parseTickerList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

export function envSkipTickers(): Set<string> {
  return new Set(parseTickerList(process.env.HISTORY_SKIP_TICKERS));
}

/** Force l'inclusion malgré le flag DB / la denylist (ops). */
export function envAllowTickers(): Set<string> {
  return new Set(parseTickerList(process.env.HISTORY_ALLOW_TICKERS));
}

export function isSikaNodataError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /\bnodata\b/i.test(error);
}

export interface HistorySkipCompany {
  ticker: string;
  skipHistoryBackfill?: boolean | null;
  historySkipReason?: string | null;
  historySkipUntil?: Date | null;
}

export function shouldSkipHistoryTicker(
  company: HistorySkipCompany,
  now = new Date()
): { skip: boolean; reason: string | null } {
  const ticker = company.ticker.toUpperCase();
  if (envAllowTickers().has(ticker)) {
    return { skip: false, reason: null };
  }
  if (envSkipTickers().has(ticker)) {
    return { skip: true, reason: "env_HISTORY_SKIP_TICKERS" };
  }
  if (company.skipHistoryBackfill) {
    const until = company.historySkipUntil;
    if (until && until.getTime() <= now.getTime()) {
      return { skip: false, reason: null };
    }
    return { skip: true, reason: company.historySkipReason || "skip_history_backfill" };
  }
  return { skip: false, reason: null };
}

export function isDefaultNodataTicker(ticker: string): boolean {
  return DEFAULT_SIKA_NODATA_TICKERS.includes(ticker.toUpperCase());
}
