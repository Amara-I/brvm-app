// Plan Vercel Hobby : au plus 2 crons, chacun au plus une fois par jour.
// Une minute ou une heure en liste, en pas ou en `*` déclenche plusieurs
// fois le même jour et le déploiement preview est refusé avant le build.

const FIXED_MINUTE = /^([0-9]|[1-5][0-9])$/;
const FIXED_HOUR = /^([0-9]|1[0-9]|2[0-3])$/;

/** Vrai si l'expression ne peut pas partir plus d'une fois par jour civil. */
export function isAtMostDailyCron(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour] = parts;
  return FIXED_MINUTE.test(minute) && FIXED_HOUR.test(hour);
}
