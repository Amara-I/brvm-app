// Évalue toutes les règles d'alerte contre les cours / indices CANONIQUES en base.
// Jamais de prix inventé. Best-effort : un sous-ensemble qui échoue n'arrête pas les autres.

import { AlertRuleKind, type Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { evaluateActivePriceAlerts } from "../alerts/evaluate-price-alerts";
import { allCompaniesWithMetrics } from "../calc/market-summary-stats";
import { loadCompaniesFullDataset } from "../api/companies-full-dataset";
import { getLatestCanonicalPrices } from "../api/latest-data";
import { getMarketSparkSeriesByTicker } from "../api/market-spark-series";
import { loadNgxScreener } from "../markets/ngx-screener";
import { ngxSignal } from "../ngx/signal";
import { HEADLINE_INDEX_CODES } from "../markets/index-catalog";
import { emitNotification, flushPendingNotificationEmails } from "./emit";
import {
  alreadyFiredToday,
  civilDateInTimeZone,
  clampDailyMovePct,
  dailyMoveHits,
  fireKey,
  fmtMoneyFor,
  fmtFcfa,
  fmtSignedPct,
  horizonLookbackDays,
  horizonReturnPct,
  isSessionCloseWindow,
  isSessionOpenWindow,
  type AlertExchange,
  alertExchangeOf,
  utcDateDaysAgo,
} from "./logic";
import { getPrefsMap } from "./prefs";
import {
  type AlertHorizonCode,
  type PrefsSnapshot,
  type SignalEntryParams,
} from "./types";
import { priceDivisor, sessionChangePercent } from "@/lib/corporate-actions/adjust";
import { actionsForTicker } from "@/lib/corporate-actions/load";
import { operationDateFromTrade } from "@/lib/corporate-actions/positions";

export type AlertEvalSummary = {
  price: { checked: number; triggered: number };
  rules: { checked: number; triggered: number };
  portfolio: { checked: number; triggered: number };
  signals: { checked: number; triggered: number };
  indices: { checked: number; triggered: number };
  sessions: { triggered: number };
  emailsFlushed: { sent: number; skipped: number };
};

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numParam(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function evaluateAllAlerts(options?: {
  tickers?: string[];
  now?: Date;
  skipEmailFlush?: boolean;
}): Promise<AlertEvalSummary> {
  const now = options?.now ?? new Date();
  const today = civilDateInTimeZone(now);
  const summary: AlertEvalSummary = {
    price: { checked: 0, triggered: 0 },
    rules: { checked: 0, triggered: 0 },
    portfolio: { checked: 0, triggered: 0 },
    signals: { checked: 0, triggered: 0 },
    indices: { checked: 0, triggered: 0 },
    sessions: { triggered: 0 },
    emailsFlushed: { sent: 0, skipped: 0 },
  };

  try {
    const price = await evaluateActivePriceAlerts(
      options?.tickers?.length ? { tickers: options.tickers } : undefined
    );
    summary.price = { checked: price.checked, triggered: price.triggered };
    await notifyFiredPriceAlerts(price.fired, now);
  } catch (err) {
    console.error("[alerts] price eval:", err instanceof Error ? err.message : err);
  }

  try {
    const rulesPart = await evaluateUserRules({ tickers: options?.tickers, now, today });
    summary.rules = rulesPart;
  } catch (err) {
    console.error("[alerts] rules eval:", err instanceof Error ? err.message : err);
  }

  try {
    const port = await evaluatePortfolioAlerts({ now, today });
    summary.portfolio = port;
  } catch (err) {
    console.error("[alerts] portfolio eval:", err instanceof Error ? err.message : err);
  }

  try {
    const sig = await evaluateSignalAlerts({ now, today });
    summary.signals = sig;
  } catch (err) {
    console.error("[alerts] signal eval:", err instanceof Error ? err.message : err);
  }

  try {
    const idx = await evaluateIndexAlerts({ now, today });
    summary.indices = idx;
  } catch (err) {
    console.error("[alerts] index eval:", err instanceof Error ? err.message : err);
  }

  try {
    summary.sessions.triggered = await evaluateSessionReminders({ now, today });
  } catch (err) {
    console.error("[alerts] session eval:", err instanceof Error ? err.message : err);
  }

  if (!options?.skipEmailFlush && isSessionCloseWindow(now)) {
    try {
      summary.emailsFlushed = await flushPendingNotificationEmails(now);
    } catch (err) {
      console.error("[alerts] email flush:", err instanceof Error ? err.message : err);
    }
  }

  return summary;
}

export async function notifyFiredPriceAlerts(
  fired: Array<{
    id: string;
    userId: string;
    ticker: string;
    direction: "ABOVE" | "BELOW";
    targetPrice: number;
    triggerPrice: number;
    exchange?: AlertExchange;
  }>,
  now = new Date()
): Promise<void> {
  if (fired.length === 0) return;
  const prefsByUser = await getPrefsMap([...new Set(fired.map((f) => f.userId))]);
  for (const item of fired) {
    const prefs = prefsByUser.get(item.userId);
    const dir = item.direction === "ABOVE" ? "≥" : "≤";
    await emitNotification({
      userId: item.userId,
      type: "PRIX",
      title: `${item.ticker} a franchi ${dir} ${fmtMoneyFor(item.exchange, item.targetPrice)}`,
      body: `Dernier cours canonique : ${fmtMoneyFor(item.exchange, item.triggerPrice)}. Ce n'est pas un ordre de bourse.`,
      ticker: item.ticker,
      exchange: item.exchange,
      preferChart: true,
      priceAlertId: item.id,
      dedupePriceAlert: true,
      prefs,
      now,
      payload: {
        direction: item.direction,
        targetPrice: item.targetPrice,
        triggerPrice: item.triggerPrice,
      },
    });
  }
}

type LatestQuote = {
  companyId: string;
  ticker: string;
  exchange: AlertExchange;
  close: number;
  date: Date;
  changePercent: number | null;
};

/**
 * Derniers cours canoniques. `exchanges` : places couvertes (défaut BRVM seule, comportement historique ;
 * les règles utilisateur passent aussi NGX). Le ticker est unique toutes places confondues.
 */
async function loadLatestQuotes(
  tickers?: string[],
  exchanges: AlertExchange[] = ["BRVM"]
): Promise<LatestQuote[]> {
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      exchange: { in: exchanges },
      ...(tickers?.length ? { ticker: { in: tickers.map((t) => t.toUpperCase()) } } : {}),
    },
    select: { id: true, ticker: true, exchange: true },
  });
  if (companies.length === 0) return [];
  const prices = await getLatestCanonicalPrices(companies.map((c) => c.id));
  const out: LatestQuote[] = [];
  for (const c of companies) {
    const row = prices.get(c.id);
    if (!row) continue;
    const close = Number(row.closePrice);
    if (!Number.isFinite(close)) continue;
    out.push({
      companyId: c.id,
      ticker: c.ticker,
      exchange: alertExchangeOf(c.exchange),
      close,
      date: row.date,
      changePercent: row.changePercent != null ? Number(row.changePercent) : null,
    });
  }
  return out;
}

async function dailyMove(quote: LatestQuote): Promise<{ change: number | null; close: number }> {
  const actions = await actionsForTicker(quote.ticker);
  const date = quote.date.toISOString().slice(0, 10);
  const close = quote.close / priceDivisor(actions, date);
  const prev = await prisma.priceHistory.findFirst({
    where: { companyId: quote.companyId, isCanonical: true, date: { lt: quote.date } },
    orderBy: { date: "desc" },
    select: { closePrice: true, date: true },
  });
  const change = sessionChangePercent(
    prev
      ? { date: prev.date.toISOString().slice(0, 10), close: Number(prev.closePrice) }
      : null,
    { date, close: quote.close },
    quote.changePercent,
    actions
  );
  return { change, close };
}

async function evaluateUserRules(opts: {
  tickers?: string[];
  now: Date;
  today: string;
}): Promise<{ checked: number; triggered: number }> {
  const rules = await prisma.alertRule.findMany({
    where: {
      enabled: true,
      ...(opts.tickers?.length ? { ticker: { in: opts.tickers.map((t) => t.toUpperCase()) } } : {}),
    },
  });
  const result = { checked: rules.length, triggered: 0 };
  if (rules.length === 0) return result;

  const userIds = [...new Set(rules.map((r) => r.userId))];
  const prefsByUser = await getPrefsMap(userIds);
  const quotes = await loadLatestQuotes(undefined, ["BRVM", "NGX"]);
  const quoteByTicker = new Map(quotes.map((q) => [q.ticker, q]));

  for (const rule of rules) {
    const prefs = prefsByUser.get(rule.userId) ?? undefined;
    const params = asRecord(rule.params);

    if (rule.kind === AlertRuleKind.DAILY_MOVE && rule.ticker) {
      const quote = quoteByTicker.get(rule.ticker);
      if (!quote) continue;
      const threshold = clampDailyMovePct(numParam(params.percent) ?? 5);
      const move = await dailyMove(quote);
      const change = move.change;
      if (change == null || !dailyMoveHits(change, threshold)) continue;
      const key = fireKey(opts.today, "DAILY", rule.ticker, threshold);
      if (alreadyFiredToday(rule.lastFireKey, key)) continue;
      const emitted = await emitNotification({
        userId: rule.userId,
        type: "PRIX",
        title: `${rule.ticker} : variation du jour ${fmtSignedPct(change)}`,
        body:
          quote.exchange === "NGX"
            ? `Seuil ${fmtSignedPct(threshold)}. Cours ${fmtMoneyFor("NGX", move.close)}.`
            : `Seuil ${fmtSignedPct(threshold)} (collier BRVM typique ±${7.5} %). Cours ${fmtFcfa(move.close)}.`,
        ticker: rule.ticker,
        exchange: quote.exchange,
        preferChart: true,
        alertRuleId: rule.id,
        prefs,
        now: opts.now,
        payload: { change, threshold, close: move.close },
      });
      if (emitted.created) {
        result.triggered += 1;
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastFiredAt: opts.now, lastFireKey: key },
        });
      }
    }

    if (rule.kind === AlertRuleKind.HORIZON_MOVE && rule.ticker) {
      const quote = quoteByTicker.get(rule.ticker);
      if (!quote) continue;
      const horizon = params.horizon === "1M" ? "1M" : "1S";
      const threshold = clampDailyMovePct(numParam(params.percent) ?? 5);
      const lookback = utcDateDaysAgo(opts.now, horizonLookbackDays(horizon as AlertHorizonCode));
      const past = await prisma.priceHistory.findFirst({
        where: {
          companyId: quote.companyId,
          isCanonical: true,
          date: { lte: lookback },
        },
        orderBy: { date: "desc" },
        select: { closePrice: true, date: true },
      });
      if (!past) continue;
      const horizonActions = await actionsForTicker(quote.ticker);
      const pastDate = past.date.toISOString().slice(0, 10);
      const quoteDate = quote.date.toISOString().slice(0, 10);
      const pastClose = Number(past.closePrice) / priceDivisor(horizonActions, pastDate);
      const quoteClose = quote.close / priceDivisor(horizonActions, quoteDate);
      const change = sessionChangePercent(
        { date: pastDate, close: Number(past.closePrice) },
        { date: quoteDate, close: quote.close },
        null,
        horizonActions
      );
      if (change == null || !dailyMoveHits(change, threshold)) continue;
      const key = fireKey(opts.today, "HORIZON", rule.ticker, horizon);
      if (alreadyFiredToday(rule.lastFireKey, key)) continue;
      const emitted = await emitNotification({
        userId: rule.userId,
        type: "PRIX",
        title: `${rule.ticker} : variation ${horizon} ${fmtSignedPct(change)}`,
        body: `Depuis le ${pastDate} (${fmtMoneyFor(quote.exchange, pastClose)}) → ${fmtMoneyFor(quote.exchange, quoteClose)}. Seuil ${fmtSignedPct(threshold)}.`,
        ticker: rule.ticker,
        exchange: quote.exchange,
        preferChart: true,
        alertRuleId: rule.id,
        prefs,
        now: opts.now,
        payload: { change, threshold, horizon },
      });
      if (emitted.created) {
        result.triggered += 1;
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastFiredAt: opts.now, lastFireKey: key },
        });
      }
    }

    if (rule.kind === AlertRuleKind.INDEX_MOVE && rule.indexCode) {
      const threshold = clampDailyMovePct(numParam(params.percent) ?? 1.5);
      const fired = await maybeFireIndexMove({
        userId: rule.userId,
        indexCode: rule.indexCode,
        threshold,
        today: opts.today,
        now: opts.now,
        prefs,
        alertRuleId: rule.id,
        lastFireKey: rule.lastFireKey,
      });
      if (fired) {
        result.triggered += 1;
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastFiredAt: opts.now, lastFireKey: fireKey(opts.today, "INDEX", rule.indexCode) },
        });
      }
    }
  }

  return result;
}

async function evaluatePortfolioAlerts(opts: {
  now: Date;
  today: string;
}): Promise<{ checked: number; triggered: number }> {
  const holdings = await prisma.portfolioHolding.findMany({
    include: {
      company: { select: { ticker: true } },
      portfolio: { select: { userId: true } },
    },
  });
  const result = { checked: holdings.length, triggered: 0 };
  if (holdings.length === 0) return result;

  const userIds = [...new Set(holdings.map((h) => h.portfolio.userId))];
  const prefsByUser = await getPrefsMap(userIds);
  const quotes = await loadLatestQuotes();
  const quoteByCompany = new Map(quotes.map((q) => [q.companyId, q]));

  for (const h of holdings) {
    const userId = h.portfolio.userId;
    const prefs = prefsByUser.get(userId);
    if (!prefs?.portfolioEnabled) continue;
    const quote = quoteByCompany.get(h.companyId);
    if (!quote) continue;

    const move = await dailyMove(quote);
    const change = move.change;
    const threshold = clampDailyMovePct(prefs.portfolioMovePct);
    if (change != null && dailyMoveHits(change, threshold)) {
      const already = await prisma.notificationEvent.findFirst({
        where: {
          userId,
          type: "PORTEFEUILLE",
          ticker: h.company.ticker,
          createdAt: { gte: new Date(`${opts.today}T00:00:00.000Z`) },
          title: { contains: "ligne" },
        },
        select: { id: true },
      });
      if (!already) {
        const emitted = await emitNotification({
          userId,
          type: "PORTEFEUILLE",
          title: `${h.company.ticker} (ligne) : ${fmtSignedPct(change)} aujourd'hui`,
          body: `Variation ≥ ${fmtSignedPct(threshold)} sur une position. Cours ${fmtFcfa(move.close)}.`,
          ticker: h.company.ticker,
          href: "/portefeuille",
          prefs,
          now: opts.now,
          payload: { change, threshold, kind: "holding_move" },
        });
        if (emitted.created) result.triggered += 1;
      }
    }

    const positionActions = await actionsForTicker(h.company.ticker);
    const positionBasis = operationDateFromTrade({
      tradedAt: (h.buyDate ?? h.createdAt).toISOString(),
      notes: h.notes,
    });
    const positionFactor = priceDivisor(positionActions, positionBasis);
    const quoteFactor = priceDivisor(positionActions, quote.date.toISOString().slice(0, 10));
    const comparableClose = quote.close / quoteFactor;
    const target = h.targetPrice != null ? Number(h.targetPrice) / positionFactor : null;
    const stop = h.stopPrice != null ? Number(h.stopPrice) / positionFactor : null;
    if (target != null && comparableClose >= target) {
      const dup = await prisma.notificationEvent.findFirst({
        where: {
          userId,
          type: "PORTEFEUILLE",
          ticker: h.company.ticker,
          createdAt: { gte: new Date(`${opts.today}T00:00:00.000Z`) },
          title: { contains: "objectif" },
        },
        select: { id: true },
      });
      if (!dup) {
        const emitted = await emitNotification({
          userId,
          type: "PORTEFEUILLE",
          title: `${h.company.ticker} : objectif ${fmtFcfa(target)} atteint`,
          body: `Cours ${fmtFcfa(comparableClose)}. Ce n'est pas un ordre de vente automatique.`,
          ticker: h.company.ticker,
          href: "/portefeuille",
          prefs,
          now: opts.now,
          payload: { kind: "target", target, close: comparableClose },
        });
        if (emitted.created) result.triggered += 1;
      }
    }
    if (stop != null && comparableClose <= stop) {
      const dup = await prisma.notificationEvent.findFirst({
        where: {
          userId,
          type: "PORTEFEUILLE",
          ticker: h.company.ticker,
          createdAt: { gte: new Date(`${opts.today}T00:00:00.000Z`) },
          title: { contains: "stop" },
        },
        select: { id: true },
      });
      if (!dup) {
        const emitted = await emitNotification({
          userId,
          type: "PORTEFEUILLE",
          title: `${h.company.ticker} : stop ${fmtFcfa(stop)} atteint`,
          body: `Cours ${fmtFcfa(comparableClose)}. Ce n'est pas un ordre de vente automatique.`,
          ticker: h.company.ticker,
          href: "/portefeuille",
          prefs,
          now: opts.now,
          payload: { kind: "stop", stop, close: comparableClose },
        });
        if (emitted.created) result.triggered += 1;
      }
    }
  }

  return result;
}

async function evaluateSignalAlerts(opts: {
  now: Date;
  today: string;
}): Promise<{ checked: number; triggered: number }> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, kind: AlertRuleKind.SIGNAL_ENTRY, ticker: { not: null } },
  });
  const holdings = await prisma.portfolioHolding.findMany({
    include: { company: { select: { ticker: true } }, portfolio: { select: { userId: true } } },
  });
  const watchers = new Map<string, Set<string>>(); // ticker -> userIds
  for (const r of rules) {
    if (!r.ticker) continue;
    if (!watchers.has(r.ticker)) watchers.set(r.ticker, new Set());
    watchers.get(r.ticker)!.add(r.userId);
  }
  for (const h of holdings) {
    if (!watchers.has(h.company.ticker)) watchers.set(h.company.ticker, new Set());
    watchers.get(h.company.ticker)!.add(h.portfolio.userId);
  }

  const result = { checked: watchers.size, triggered: 0 };
  if (watchers.size === 0) return result;

  // Place de chaque titre suivi : BRVM → score BRVM ; NGX → note NGX (même matrice de décision, lib/ngx/signal.ts).
  const placed = await prisma.company.findMany({
    where: { ticker: { in: [...watchers.keys()] } },
    select: { ticker: true, exchange: true },
  });
  const exchangeByTicker = new Map(placed.map((c) => [c.ticker, alertExchangeOf(c.exchange)] as const));
  const watchedExchanges = new Set([...watchers.keys()].map((t) => exchangeByTicker.get(t) ?? "BRVM"));

  const byTicker = new Map<string, { label: string; score: number }>();
  if (watchedExchanges.has("BRVM")) {
    const [dataset, spark] = await Promise.all([
      loadCompaniesFullDataset(),
      getMarketSparkSeriesByTicker().catch(() => ({})),
    ]);
    for (const { co, metrics: m } of allCompaniesWithMetrics(dataset, spark)) {
      byTicker.set(co.ticker, { label: m.signal.label, score: m.score });
    }
  }
  if (watchedExchanges.has("NGX")) {
    const screener = await loadNgxScreener().catch(() => null);
    for (const row of screener?.rows ?? []) {
      const signal = ngxSignal(row.overall, row.pillars.risk, row.confidence);
      if (signal && row.overall != null) byTicker.set(row.ticker, { label: signal.label, score: row.overall });
    }
  }
  const prefsByUser = await getPrefsMap([...new Set([...watchers.values()].flatMap((s) => [...s]))]);

  for (const [ticker, userIds] of watchers) {
    const m = byTicker.get(ticker);
    if (!m) continue;
    const label = m.label;
    const score = m.score;
    const exchange = exchangeByTicker.get(ticker) ?? "BRVM";
    const isStrong = label === "ACHAT FORT" || label === "ACHAT";
    if (!isStrong) continue;

    for (const userId of userIds) {
      const prefs = prefsByUser.get(userId);
      if (!prefs?.signalEnabled) continue;
      const rule = rules.find((r) => r.userId === userId && r.ticker === ticker);
      const params = rule ? (asRecord(rule.params) as SignalEntryParams) : { signal: "ACHAT FORT" as const };
      const wanted = params.signal ?? "ACHAT FORT";
      if (wanted === "ACHAT FORT" && label !== "ACHAT FORT") continue;
      if (params.minScore != null && score < params.minScore) continue;

      const key = fireKey(opts.today, ticker, label.replace(/\s+/g, "_"));
      if (rule && alreadyFiredToday(rule.lastFireKey, key)) continue;

      const already = await prisma.notificationEvent.findFirst({
        where: {
          userId,
          type: "SIGNAUX",
          ticker,
          createdAt: { gte: new Date(`${opts.today}T00:00:00.000Z`) },
        },
        select: { id: true },
      });
      if (already) continue;

      const emitted = await emitNotification({
        userId,
        type: "SIGNAUX",
        title: `${ticker} entre en ${label}`,
        body: `Score ${score}/100. Une seule alerte signal par titre et par jour. Ce n'est pas un conseil personnalisé.`,
        ticker,
        exchange,
        alertRuleId: rule?.id ?? null,
        prefs,
        now: opts.now,
        payload: { signal: label, score },
      });
      if (emitted.created) {
        result.triggered += 1;
        if (rule) {
          await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastFiredAt: opts.now, lastFireKey: key },
          });
        }
      }
    }
  }

  return result;
}

async function latestIndexChange(code: string): Promise<{ value: number; change: number } | null> {
  const index = await prisma.marketIndex.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!index) return null;
  const latest = await prisma.marketIndexValue.findFirst({
    where: { marketIndexId: index.id, isCanonical: true, date: { lte: new Date() } },
    orderBy: { date: "desc" },
  });
  if (!latest) return null;
  const value = Number(latest.value);
  if (latest.changePercent != null && Number.isFinite(Number(latest.changePercent))) {
    return { value, change: Number(latest.changePercent) };
  }
  const prev = await prisma.marketIndexValue.findFirst({
    where: { marketIndexId: index.id, isCanonical: true, date: { lt: latest.date } },
    orderBy: { date: "desc" },
  });
  if (!prev) return null;
  const change = horizonReturnPct(Number(prev.value), value);
  return change == null ? null : { value, change };
}

async function maybeFireIndexMove(input: {
  userId: string;
  indexCode: string;
  threshold: number;
  today: string;
  now: Date;
  prefs?: PrefsSnapshot;
  alertRuleId?: string;
  lastFireKey?: string | null;
}): Promise<boolean> {
  const snap = await latestIndexChange(input.indexCode);
  if (!snap || !dailyMoveHits(snap.change, input.threshold)) return false;
  const key = fireKey(input.today, "INDEX", input.indexCode);
  if (alreadyFiredToday(input.lastFireKey, key)) return false;
  const already = await prisma.notificationEvent.findFirst({
    where: {
      userId: input.userId,
      type: "INDICES",
      indexCode: input.indexCode,
      createdAt: { gte: new Date(`${input.today}T00:00:00.000Z`) },
    },
    select: { id: true },
  });
  if (already) return false;
  const emitted = await emitNotification({
    userId: input.userId,
    type: "INDICES",
    title: `${input.indexCode} : ${fmtSignedPct(snap.change)}`,
    body: `Variation ≥ ${fmtSignedPct(input.threshold)}. Niveau ${snap.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}.`,
    indexCode: input.indexCode,
    alertRuleId: input.alertRuleId ?? null,
    prefs: input.prefs,
    now: input.now,
    payload: { change: snap.change, value: snap.value, threshold: input.threshold },
  });
  return emitted.created;
}

async function evaluateIndexAlerts(opts: {
  now: Date;
  today: string;
}): Promise<{ checked: number; triggered: number }> {
  const prefsRows = await prisma.notificationPreference.findMany({
    where: { indexEnabled: true },
    select: { userId: true, indexMovePct: true },
  });
  const result = { checked: prefsRows.length * HEADLINE_INDEX_CODES.length, triggered: 0 };
  if (prefsRows.length === 0) return result;
  const prefsByUser = await getPrefsMap(prefsRows.map((r) => r.userId));

  for (const row of prefsRows) {
    const prefs = prefsByUser.get(row.userId);
    const threshold = clampDailyMovePct(Number(row.indexMovePct));
    for (const code of HEADLINE_INDEX_CODES) {
      const fired = await maybeFireIndexMove({
        userId: row.userId,
        indexCode: code,
        threshold,
        today: opts.today,
        now: opts.now,
        prefs,
      });
      if (fired) result.triggered += 1;
    }
  }
  return result;
}

async function evaluateSessionReminders(opts: { now: Date; today: string }): Promise<number> {
  const open = isSessionOpenWindow(opts.now);
  const close = isSessionCloseWindow(opts.now);
  if (!open && !close) return 0;

  const users = await prisma.notificationPreference.findMany({
    where: { sessionReminders: true, portfolioEnabled: true },
    select: { userId: true },
  });
  if (users.length === 0) return 0;
  const prefsByUser = await getPrefsMap(users.map((u) => u.userId));
  const kind = open ? "open" : "close";
  const title = open ? "Ouverture de séance BRVM" : "Clôture de séance BRVM";
  const body = open
    ? "Rappel : la séance BRVM ouvre vers 9h00 (Abidjan). Pensez à vérifier vos lignes — ce n'est pas un conseil d'investissement."
    : "Rappel : la séance BRVM clôture vers 15h30 (Abidjan). Revue de portefeuille facultative — ce n'est pas un conseil d'investissement.";

  let triggered = 0;
  for (const u of users) {
    const already = await prisma.notificationEvent.findFirst({
      where: {
        userId: u.userId,
        type: "SYSTEME",
        createdAt: { gte: new Date(`${opts.today}T00:00:00.000Z`) },
        title,
      },
      select: { id: true },
    });
    if (already) continue;
    const emitted = await emitNotification({
      userId: u.userId,
      type: "SYSTEME",
      title,
      body,
      href: "/portefeuille",
      prefs: prefsByUser.get(u.userId),
      now: opts.now,
      payload: { kind: `session_${kind}` },
    });
    if (emitted.created) triggered += 1;
  }
  return triggered;
}
