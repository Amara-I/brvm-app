// Fraîcheur des cours : traduit « dernière synchro » + « horloge de séance »
// en un état lisible (séance en cours / clôture / données anciennes).
//
// Horaires en UTC, alignés sur .github/workflows/intraday-quotes.yml :
//   - BRVM : 09:00–15:30 (Abidjan = UTC) ;
//   - NGX  : 08:30–13:30 (09:30–14:30 à Lagos).
// Les jours fériés ne sont pas connus : un jour férié sans séance apparaît
// donc « données anciennes » le lendemain matin, jamais « en cours » à tort.

export type FreshnessExchange = "BRVM" | "NGX";
export type FreshnessState = "LIVE" | "CLOSED" | "STALE" | "UNKNOWN";

const SESSIONS: Record<FreshnessExchange, { open: number; close: number }> = {
  BRVM: { open: 9 * 60, close: 15 * 60 + 30 },
  NGX: { open: 8 * 60 + 30, close: 13 * 60 + 30 },
};

/** Au-delà, un cours intraday n'est plus « en direct » (le rafraîchissement tourne toutes les 30 min). */
export const LIVE_MAX_AGE_MS = 90 * 60 * 1000;

function isWeekday(d: Date): boolean {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function sessionStartOn(d: Date, exchange: FreshnessExchange): Date {
  const { open } = SESSIONS[exchange];
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(open / 60), open % 60)
  );
}

export function isSessionOpen(exchange: FreshnessExchange, now: Date): boolean {
  if (!isWeekday(now)) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const { open, close } = SESSIONS[exchange];
  return minutes >= open && minutes <= close;
}

/** Début de la séance la plus récente déjà commencée (week-ends ignorés). */
export function lastSessionStart(exchange: FreshnessExchange, now: Date): Date {
  let day = new Date(now.getTime());
  for (let i = 0; i < 8; i++) {
    const start = sessionStartOn(day, exchange);
    if (isWeekday(day) && start.getTime() <= now.getTime()) return start;
    day = new Date(day.getTime() - 24 * 60 * 60 * 1000);
  }
  return sessionStartOn(now, exchange);
}

export function marketFreshness(input: {
  exchange: FreshnessExchange;
  asOf: Date | string | null | undefined;
  now: Date;
}): FreshnessState {
  const { exchange, now } = input;
  if (!input.asOf) return "UNKNOWN";
  const asOf = input.asOf instanceof Date ? input.asOf : new Date(input.asOf);
  if (Number.isNaN(asOf.getTime())) return "UNKNOWN";

  if (isSessionOpen(exchange, now)) {
    return now.getTime() - asOf.getTime() <= LIVE_MAX_AGE_MS ? "LIVE" : "STALE";
  }
  return asOf.getTime() >= lastSessionStart(exchange, now).getTime() ? "CLOSED" : "STALE";
}

/** Place supportée par l'indicateur (les autres places ne sont pas encore live). */
export function freshnessExchangeOf(code: string | null | undefined): FreshnessExchange | null {
  return code === "BRVM" || code === "NGX" ? code : null;
}
