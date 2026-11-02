import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enrichmentSchema, historyWork, type EnrichmentOptions } from "./plan";
import { appendPrices, appendPublications } from "./persist";
import { collectBrvmPublications, collectNgxPublications } from "./publications";
import { sikafinanceConnector } from "../connectors/sikafinance_connector";
import { ngxOfficialListPdfUrl, ngxDailySummaryPdfUrl } from "../ngx/urls";
import { loadNgxEquities } from "../ngx/load-session";
import { applyNgxTickerAliases } from "../ngx/ticker-aliases";
import { runWithFetchDeadline } from "../fetch-budget";
import type { RawPriceQuote } from "../types";

export async function runAdditiveEnrichment(input: EnrichmentOptions, db: PrismaClient = prisma) {
  const opts = enrichmentSchema.parse(input);
  const apply = opts.apply === "1";
  const now = new Date(); const to = opts.to ?? now.toISOString().slice(0, 10);
  if (to > now.toISOString().slice(0, 10)) throw new Error("La fin ne doit pas être future");
  const started = Date.now();
  const universe = await db.company.findMany({ where: { exchange: opts.exchange }, select: { id: true, ticker: true, name: true, isin: true }, orderBy: { ticker: "asc" } });
  const companies = opts.ticker ? universe.filter((c) => c.ticker === opts.ticker) : universe;
  if (!companies.length) throw new Error("Aucune société dans le périmètre demandé");
  const ids = new Map(companies.map((c) => [c.ticker, c.id]));
  const work = opts.kind === "history" ? historyWork(opts.exchange, companies.map((c) => c.ticker), opts.from, to) :
    [...companies.map((c) => ({ ticker: c.ticker, from: opts.from, to })), ...(opts.exchange === "BRVM" ? [{ ticker: null, from: opts.from, to }] : [])];
  // Un périmètre différent (titres/fenêtre) ne reprend jamais le curseur d'un autre job.
  // Fin implicite exclue de la clé : une nouvelle journée prolonge la même file chronologique.
  const jobKey = createHash("sha256").update(JSON.stringify([opts.exchange, opts.kind, opts.from, opts.to ?? "rolling", companies.map((c) => c.id)])).digest("hex");
  let cursor = opts.cursor ?? 0;
  if (opts.cursor == null) {
    const logs = await db.ingestionLog.findMany({ where: { source: opts.exchange === "NGX" ? "NGX_OFFICIEL" : "SIKAFINANCE" },
      orderBy: { runAt: "desc" }, take: 100, select: { errors: true } });
    for (const log of logs) {
      const payload = log.errors as { kind?: string; jobKey?: string; next?: number } | null;
      if (payload?.kind === "ADDITIVE_ENRICHMENT" && payload.jobKey === jobKey && typeof payload.next === "number") { cursor = payload.next; break; }
    }
  }
  if (cursor > work.length) throw new Error("Curseur hors périmètre");
  // Les publications sont réinterrogées au cycle suivant ; les cours terminés restent terminés.
  if (opts.kind === "publications" && cursor === work.length) cursor = 0;
  const results: Array<Record<string, unknown>> = [];
  let next = cursor; let failed = false;
  const deadline = started + opts.budgetMs;
  await runWithFetchDeadline(deadline - 10000, async () => {
    for (; next < work.length && results.length < opts.limit; next++) {
      if (deadline - Date.now() < 15000) break;
      const item = work[next];
      try {
        if (opts.kind === "publications") {
          const all = opts.exchange === "NGX" ? await collectNgxPublications(item.ticker!) : await collectBrvmPublications(universe, item.ticker);
          const rows = all.filter((r) => !r.publishedAt || (r.publishedAt.slice(0, 10) >= opts.from && r.publishedAt.slice(0, 10) <= to));
          results.push({ ...item, collected: rows.length, ...await appendPublications(db, rows, ids, apply) });
        } else {
          let quotes: RawPriceQuote[] = [];
          let sourceUrl = "https://www.sikafinance.com/api/general/GetHistos";
          if (opts.exchange === "BRVM") {
            const part = await sikafinanceConnector.fetchHistos(item.ticker!, item.from, item.to, "0");
            if (!part.ok) throw new Error(part.error);
            quotes = part.data.filter((q) => q.date >= item.from && q.date <= item.to);
          } else {
            const part = await loadNgxEquities({ onlyDate: item.from, allowJson: false, listings: universe, deadlineMs: deadline - 10000 });
            // Un 404 peut être un férié OU une archive non publiée ; ce n'est pas une séance certifiée complète.
            if (!part.ok) {
              if (!part.absent) throw new Error(part.warnings.join(" | "));
              results.push({ ...item, status: "ARCHIVE_ABSENTE", warnings: part.warnings }); continue;
            }
            sourceUrl = part.kind === "daily-summary" ? ngxDailySummaryPdfUrl(item.from) : ngxOfficialListPdfUrl(item.from);
            const aliased = applyNgxTickerAliases(part.quotes, new Set(universe.map((c) => c.ticker)));
            quotes = aliased.quotes.filter((q) => q.tradeDate === item.from).map((q) => ({ ticker: q.symbol, date: q.tradeDate,
              closePrice: q.close, volume: q.volume, source: "NGX_OFFICIEL", fetchedAt: new Date().toISOString() }));
          }
          const persisted = await appendPrices(db, quotes, ids, apply);
          results.push({ ...item, sourceUrl, granularity: "daily", collected: quotes.length,
            status: persisted.quarantined ? "CONFLIT_AUDIT_REQUIS" : quotes.length ? "SOURCE_REPONDUE" : "SOURCE_SANS_DONNEES", ...persisted });
          if (persisted.quarantined) { failed = true; break; }
        }
      } catch (err) {
        results.push({ ...item, status: "ECHEC", error: err instanceof Error ? err.message : String(err) });
        failed = true; break; // Ne jamais marquer un échec réseau comme une fenêtre épuisée.
      }
    }
  });
  const summary = { kind: "ADDITIVE_ENRICHMENT", jobKey, exchange: opts.exchange, operation: opts.kind, apply,
    from: opts.from, to, next, total: work.length, incomplete: next < work.length, failed,
    durationMs: Date.now() - started, results };
  if (apply) await db.ingestionLog.create({ data: { source: opts.exchange === "NGX" ? "NGX_OFFICIEL" : "SIKAFINANCE",
    status: failed ? "PARTIAL" : "SUCCESS", finishedAt: new Date(), durationMs: summary.durationMs,
    errors: summary as unknown as Prisma.InputJsonValue } });
  return summary;
}
