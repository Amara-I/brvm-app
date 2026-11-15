// Cadence du sondage « dernier cours » selon les heures de séance.
//   BRVM : lun–ven 09:00–15:30 UTC (Abidjan = UTC).
//   NGX  : lun–ven 09:30–14:30 heure de Lagos (UTC+1) = 08:30–13:30 UTC.
// En séance : 60 s. Après la clôture, jusqu'à 18:30 UTC (le cron quotidien de
// 17:00 UTC apporte les clôtures officielles) : 5 min. Reste de la semaine : 30 min.
// Week-end : aucun sondage (le marché est fermé), seul le retour sur l'onglet relit.

import type { QuoteMarket } from "./types";

export const OPEN_POLL_MS = 60_000;
export const AFTER_CLOSE_POLL_MS = 5 * 60_000;
export const OFF_HOURS_POLL_MS = 30 * 60_000;
/** Écart minimal entre deux relectures déclenchées par le retour sur l'onglet. */
export const FOCUS_MIN_GAP_MS = 30_000;

const SESSIONS_UTC: Record<QuoteMarket, { open: number; close: number }> = {
  BRVM: { open: 9 * 60, close: 15 * 60 + 30 },
  NGX: { open: 8 * 60 + 30, close: 13 * 60 + 30 },
};
/** Fin de la fenêtre « après clôture » (cron quotidien à 17:00 UTC + marge). */
const AFTER_CLOSE_END_UTC = 18 * 60 + 30;

export type MarketPhase = "open" | "afterClose" | "offHours" | "weekend";

export function marketPhase(market: QuoteMarket, now: Date = new Date()): MarketPhase {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return "weekend";
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const s = SESSIONS_UTC[market];
  if (minutes >= s.open && minutes < s.close) return "open";
  if (minutes >= s.close && minutes < AFTER_CLOSE_END_UTC) return "afterClose";
  return "offHours";
}

/** Délai avant le prochain sondage, ou null (week-end : pas de sondage). */
export function quotePollDelayMs(market: QuoteMarket, now: Date = new Date()): number | null {
  switch (marketPhase(market, now)) {
    case "open":
      return OPEN_POLL_MS;
    case "afterClose":
      return AFTER_CLOSE_POLL_MS;
    case "offHours":
      return OFF_HOURS_POLL_MS;
    default:
      return null;
  }
}

/** Retour sur l'onglet : relire si la dernière lecture date d'au moins ce délai. */
export function focusRefreshGapMs(market: QuoteMarket, now: Date = new Date()): number {
  const delay = quotePollDelayMs(market, now);
  if (delay == null) return OFF_HOURS_POLL_MS;
  return Math.max(FOCUS_MIN_GAP_MS, Math.min(delay, OFF_HOURS_POLL_MS));
}

/** Places visées par l'ingestion intrajournalière (`market=BRVM|NGX|ALL`, défaut BRVM). */
export function intradayMarkets(raw: string | null | undefined): QuoteMarket[] {
  const v = String(raw ?? "BRVM").trim().toUpperCase();
  if (v === "ALL") return ["BRVM", "NGX"];
  if (v === "NGX") return ["NGX"];
  return ["BRVM"];
}

/** Ingestion intrajournalière utile : en séance, ou dans l'heure qui suit la clôture. */
export function intradayWindowOpen(market: QuoteMarket, now: Date = new Date()): boolean {
  const phase = marketPhase(market, now);
  if (phase === "open") return true;
  if (phase !== "afterClose") return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes < SESSIONS_UTC[market].close + 60;
}
