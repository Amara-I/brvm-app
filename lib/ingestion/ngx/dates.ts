/** Dates des PDF NGX : `DD-MM-YYYY` dans l'URL, `DD/MM/YY` dans le texte. */

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function shiftIsoDate(iso: string, days: number): string {
  const dt = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoDate(dt);
}

export function isWeekday(iso: string): boolean {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

export function weekdayOnOrBefore(iso: string): string {
  let cur = iso.slice(0, 10);
  while (!isWeekday(cur)) cur = shiftIsoDate(cur, -1);
  return cur;
}

/** `count` séances de semaine, de `fromIso` en remontant. */
export function recentWeekdays(fromIso: string, count: number): string[] {
  const out: string[] = [];
  let cur = weekdayOnOrBefore(fromIso);
  while (out.length < count) {
    out.push(cur);
    cur = shiftIsoDate(cur, -1);
    while (!isWeekday(cur)) cur = shiftIsoDate(cur, -1);
  }
  return out;
}

/** Jours de semaine inclusifs, du plus ancien au plus récent. */
export function weekdaysBetween(fromIso: string, toIso: string): string[] {
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    if (isWeekday(cur)) out.push(cur);
    cur = shiftIsoDate(cur, 1);
  }
  return out;
}

/** `2026-10-27` → `27-10-2026`. */
export function formatNgxDocDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** `27/10/2026`, `27-10-2026` ou `27/10/26` → `YYYY-MM-DD`. */
export function parseNgxDocDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || year < 1990 || year > 2100) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00.000Z`);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== mm || check.getUTCDate() !== dd) return null;
  return iso;
}

export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}
