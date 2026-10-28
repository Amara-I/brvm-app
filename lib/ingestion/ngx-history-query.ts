// Paramètres de GET /api/cron/ngx-history. Pur, sans Prisma.
// Le budget est plafonné à 240 s : Hobby coupe la fonction à 300 s
// (`maxDuration`) et le cron doit répondre avant.

import { parseNgxDocDate } from "./ngx/dates";

export const NGX_HISTORY_MAX_BUDGET_MS = 240_000;
export const NGX_HISTORY_DEFAULT_BUDGET_MS = 240_000;
export const NGX_HISTORY_DEFAULT_LIMIT = 20;
export const NGX_HISTORY_MAX_LIMIT = 60;

export interface NgxHistoryQuery {
  from?: string;
  to?: string;
  /** Une seule séance (PDF, ou JSON si c'est la séance courante). */
  date?: string;
  /** Prochaine date renvoyée par l'appel précédent. */
  cursor?: string;
  /** 0 = pas de PDF (refresh charts / fx seulement). */
  limit: number;
  budgetMs: number;
  charts: boolean;
  fx: boolean;
  indices: boolean;
  /** Reprise du refresh `chart_series` (`after` de refreshChartSeries). */
  chartsAfter?: string;
  /** force=1 : reconstruit toutes les chart_series NGX, même à jour. */
  chartsForce: boolean;
  resume: boolean;
  /** La séance demandée peut être le JSON du jour. */
  tryJson: boolean;
}

function flag(raw: string | null, whenOmitted: boolean): boolean {
  if (raw == null || raw.trim() === "") return whenOmitted;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off" || value === "no") return false;
  if (value === "1" || value === "true" || value === "on" || value === "yes") return true;
  return whenOmitted;
}

export function parseLooseIsoDate(raw: string, now = new Date()): string | null {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    if (!year || !month || !day) return null;
    const check = new Date(`${text}T00:00:00.000Z`);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
    return text;
  }
  const dayMonth = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dayMonth) {
    const dd = dayMonth[1]!.padStart(2, "0");
    const mm = dayMonth[2]!.padStart(2, "0");
    return parseNgxDocDate(`${dd}/${mm}/${now.getUTCFullYear()}`);
  }
  return parseNgxDocDate(text);
}

export function clampNgxHistoryBudgetMs(raw: string | null): number {
  if (raw == null || raw.trim() === "") return NGX_HISTORY_DEFAULT_BUDGET_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return NGX_HISTORY_DEFAULT_BUDGET_MS;
  return Math.min(NGX_HISTORY_MAX_BUDGET_MS, Math.floor(value));
}

export function parseNgxHistorySearchParams(q: URLSearchParams, now = new Date()): NgxHistoryQuery {
  const date = q.get("date") ? parseLooseIsoDate(q.get("date") ?? "", now) ?? undefined : undefined;
  const from = q.get("from") ? parseLooseIsoDate(q.get("from") ?? "", now) ?? undefined : undefined;
  const to = q.get("to") ? parseLooseIsoDate(q.get("to") ?? "", now) ?? undefined : undefined;
  const cursor = q.get("cursor") ? parseLooseIsoDate(q.get("cursor") ?? "", now) ?? undefined : undefined;
  const limitRaw = q.get("limit");
  let limit = NGX_HISTORY_DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw.trim() !== "") {
    const parsed = Number(limitRaw);
    limit = Number.isFinite(parsed) ? Math.max(0, Math.min(NGX_HISTORY_MAX_LIMIT, Math.floor(parsed))) : NGX_HISTORY_DEFAULT_LIMIT;
  }
  if (date) limit = Math.min(limit, 1);

  const singleDay = Boolean(date);
  return {
    from: date ?? from,
    to: date ?? to,
    date,
    cursor,
    limit,
    budgetMs: clampNgxHistoryBudgetMs(q.get("budgetMs")),
    charts: flag(q.get("charts"), singleDay),
    fx: flag(q.get("fx"), singleDay),
    indices: flag(q.get("indices"), true),
    chartsAfter: q.get("after")?.trim().toUpperCase() || undefined,
    chartsForce: flag(q.get("force"), false),
    resume: flag(q.get("resume"), true),
    tryJson: singleDay,
  };
}
