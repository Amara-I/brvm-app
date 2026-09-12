export type CountRow = { key: string; count: number; label?: string };

export type DailyPoint = { date: string; count: number };

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function emptyDailySeries(days: number, now = new Date()): DailyPoint[] {
  const safeDays = days === 30 ? 30 : 7;
  const points: DailyPoint[] = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    points.push({ date: utcDayKey(d), count: 0 });
  }
  return points;
}

export function fillDailySeries(
  countsByDay: Record<string, number>,
  days: number,
  now = new Date()
): DailyPoint[] {
  return emptyDailySeries(days, now).map((point) => ({
    date: point.date,
    count: countsByDay[point.date] ?? 0,
  }));
}

export function rankCounts(rows: CountRow[], limit = 15): CountRow[] {
  return [...rows].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, limit);
}

export function parseAnalyticsDays(raw: unknown): 7 | 30 {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : 7;
  return n === 30 ? 30 : 7;
}

export function sinceDate(days: 7 | 30, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
