import { z } from "zod";
const day = z.iso.date();
export const enrichmentSchema = z.object({
  exchange: z.enum(["BRVM", "NGX"]),
  kind: z.enum(["history", "publications"]).default("history"),
  from: day.default("2006-01-01"),
  to: day.optional(),
  ticker: z.string().regex(/^[A-Z0-9.-]{1,24}$/).optional(),
  cursor: z.coerce.number().int().min(0).max(5_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(2),
  budgetMs: z.coerce.number().int().min(10000).max(240000).default(180000),
  apply: z.enum(["0", "1"]).default("0"),
}).superRefine((v, ctx) => {
  if (v.from < "2000-01-01") ctx.addIssue({ code: "custom", message: "from doit être postérieur à 1999" });
  if (v.from > (v.to ?? new Date().toISOString().slice(0, 10))) ctx.addIssue({ code: "custom", message: "from doit précéder to" });
});
export type EnrichmentOptions = z.infer<typeof enrichmentSchema>;
export interface WorkItem { ticker: string | null; from: string; to: string }

/** BRVM : fenêtres mensuelles ≤31 jours, pas une interpolation mensuelle ; NGX : PDF par séance. */
export function historyWork(exchange: "BRVM" | "NGX", tickers: string[], from: string, to: string): WorkItem[] {
  const windows: WorkItem[] = [];
  let start = new Date(`${from}T00:00:00Z`);
  while (start.toISOString().slice(0, 10) <= to) {
    const iso = start.toISOString().slice(0, 10);
    if (exchange === "NGX") {
      if (start.getUTCDay() !== 0 && start.getUTCDay() !== 6) windows.push({ ticker: null, from: iso, to: iso });
      start.setUTCDate(start.getUTCDate() + 1);
    } else {
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      windows.push({ ticker: null, from: iso, to: end < to ? end : to });
      start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    }
  }
  // Alterner les titres à chaque fenêtre, pour ne pas bloquer tout l'univers derrière le premier titre.
  return exchange === "NGX" ? windows : windows.flatMap((w) => tickers.map((ticker) => ({ ...w, ticker })));
}
