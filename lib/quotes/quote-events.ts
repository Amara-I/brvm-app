// Demande de relecture immédiate d'un cours (ex. une notification vient d'arriver
// ou d'être ouverte). Les composants abonnés via useLiveQuotes relisent aussitôt.

export const QUOTE_REFRESH_EVENT = "ouestbourse:quote-refresh";

export interface QuoteRefreshDetail {
  /** Tickers concernés ; vide = tous les cours affichés. */
  tickers: string[];
}

const PENDING_KEY = "ouestbourse:quote-refresh-at";
/** Une page ouverte juste après la demande (clic sur une notification) relit sans cache CDN. */
const PENDING_WINDOW_MS = 60_000;

/** Vrai si une relecture immédiate a été demandée il y a moins d'une minute (navigation incluse). */
export function hasPendingQuoteRefresh(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(window.sessionStorage.getItem(PENDING_KEY) ?? 0);
    return Number.isFinite(at) && at > 0 && now - at < PENDING_WINDOW_MS;
  } catch {
    return false;
  }
}

export function requestQuoteRefresh(tickers: Array<string | null | undefined> = []): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : l'événement suffit pour la page courante */
  }
  const detail: QuoteRefreshDetail = {
    tickers: [...new Set(tickers.filter((t): t is string => Boolean(t)).map((t) => t.toUpperCase()))],
  };
  window.dispatchEvent(new CustomEvent<QuoteRefreshDetail>(QUOTE_REFRESH_EVENT, { detail }));
}

/** Vrai si l'événement concerne au moins un des tickers suivis. */
export function refreshConcerns(detail: QuoteRefreshDetail | null | undefined, watched: readonly string[]): boolean {
  if (!detail || detail.tickers.length === 0) return true;
  const set = new Set(watched.map((t) => t.toUpperCase()));
  if (set.size === 0) return true;
  return detail.tickers.some((t) => set.has(t));
}
