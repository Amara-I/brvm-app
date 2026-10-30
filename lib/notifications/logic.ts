import {
  BRVM_DAILY_COLLAR_MAX_PCT,
  BRVM_DAILY_COLLAR_PCT,
  BRVM_DAILY_MOVE_MIN_PCT,
  BRVM_TZ,
  HORIZON_DAYS,
  type AlertHorizonCode,
} from "./types";

/** Heure locale 0–23 dans `timeZone` (Africa/Abidjan = UTC toute l'année). */
export function hourInTimeZone(now: Date, timeZone = BRVM_TZ): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return Number.isFinite(hour) ? hour : now.getUTCHours();
}

/** Date civile YYYY-MM-DD dans le fuseau marché. */
export function civilDateInTimeZone(now: Date, timeZone = BRVM_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return now.toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

/**
 * Heures calmes : si start > end, la plage traverse minuit
 * (ex. 22 → 7). Sinon plage intra-journée (ex. 12 → 14).
 * `null` de part et d'autre = pas de heures calmes.
 */
export function isInQuietHours(
  now: Date,
  startHour: number | null | undefined,
  endHour: number | null | undefined,
  timeZone = BRVM_TZ
): boolean {
  if (startHour == null || endHour == null) return false;
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return false;
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) return false;
  if (startHour === endHour) return true;
  const hour = hourInTimeZone(now, timeZone);
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export function clampDailyMovePct(raw: number): number {
  if (!Number.isFinite(raw)) return BRVM_DAILY_COLLAR_PCT;
  return Math.min(BRVM_DAILY_COLLAR_MAX_PCT, Math.max(BRVM_DAILY_MOVE_MIN_PCT, raw));
}

export function dailyMoveHits(changePercent: number, thresholdPct: number): boolean {
  if (!Number.isFinite(changePercent) || !Number.isFinite(thresholdPct)) return false;
  return Math.abs(changePercent) + 1e-9 >= thresholdPct;
}

export function priceCrossHits(direction: "ABOVE" | "BELOW", price: number, target: number): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(target)) return false;
  return direction === "ABOVE" ? price >= target : price <= target;
}

export function horizonReturnPct(fromPrice: number, toPrice: number): number | null {
  if (!(fromPrice > 0) || !Number.isFinite(fromPrice) || !Number.isFinite(toPrice)) return null;
  const pct = ((toPrice - fromPrice) / fromPrice) * 100;
  return Number.isFinite(pct) ? pct : null;
}

export function horizonLookbackDays(horizon: AlertHorizonCode): number {
  return HORIZON_DAYS[horizon];
}

export function utcDateDaysAgo(from: Date, days: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** Fenêtre d'ouverture BRVM : 8h–10h Abidjan. */
export function isSessionOpenWindow(now: Date, timeZone = BRVM_TZ): boolean {
  const h = hourInTimeZone(now, timeZone);
  return h >= 8 && h <= 10;
}

/** Fenêtre de clôture / revue : 15h–17h Abidjan (ingest quotidien ~17h UTC). */
export function isSessionCloseWindow(now: Date, timeZone = BRVM_TZ): boolean {
  const h = hourInTimeZone(now, timeZone);
  return h >= 15 && h <= 17;
}

export function fireKey(...parts: Array<string | number>): string {
  return parts.map((p) => String(p).replace(/\s+/g, "_")).join(":");
}

export function alreadyFiredToday(lastFireKey: string | null | undefined, key: string): boolean {
  return Boolean(lastFireKey && lastFireKey === key);
}

/** Place d'un titre pour les alertes. Défaut BRVM : le comportement historique ne change pas. */
export type AlertExchange = "BRVM" | "NGX";

export function alertExchangeOf(raw: string | null | undefined): AlertExchange {
  return raw === "NGX" ? "NGX" : "BRVM";
}

export function deepLinkFor(input: {
  type: "PRIX" | "SIGNAUX" | "PORTEFEUILLE" | "INDICES" | "SYSTEME";
  ticker?: string | null;
  indexCode?: string | null;
  preferChart?: boolean;
  exchange?: AlertExchange | null;
}): string {
  if (input.exchange === "NGX" && input.ticker && input.type !== "PORTEFEUILLE" && input.type !== "INDICES") {
    // Fiche NGX : le graphe est intégré à la fiche (ancre #ngx-chart).
    const base = `/marches/ngx/actions/${encodeURIComponent(input.ticker)}`;
    return input.preferChart ? `${base}#ngx-chart` : base;
  }
  if (input.exchange === "NGX" && input.type === "SIGNAUX") return "/marches/ngx/screener";
  if (input.exchange === "NGX" && input.type === "PRIX") return "/marches/ngx";
  if (input.type === "PORTEFEUILLE") return "/portefeuille";
  if (input.type === "INDICES") {
    if (input.indexCode) return `/indices/${encodeURIComponent(input.indexCode)}`;
    return "/indices";
  }
  if (input.ticker) {
    if (input.preferChart) return `/graphes?ticker=${encodeURIComponent(input.ticker)}`;
    return `/actions/${encodeURIComponent(input.ticker)}`;
  }
  if (input.type === "SIGNAUX") return "/screener";
  if (input.type === "PRIX") return "/marche";
  return "/notifications";
}

export function fmtFcfa(n: number): string {
  if (!Number.isFinite(n)) return "N/D";
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

/** Montant en naira pour les e-mails / notifications : « ₦29,50 » (2 décimales, comme la fiche NGX). */
export function fmtNgn(n: number): string {
  if (!Number.isFinite(n)) return "N/D";
  return `₦${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Montant dans la devise de la place : BRVM → « 1 234 FCFA », NGX → « ₦29,50 ». */
export function fmtMoneyFor(exchange: AlertExchange | null | undefined, n: number): string {
  return exchange === "NGX" ? fmtNgn(n) : fmtFcfa(n);
}

export function fmtSignedPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "N/D";
  const abs = Math.abs(n).toFixed(digits).replace(".", ",");
  return `${n >= 0 ? "+" : "−"}${abs} %`;
}
