// Collecte des actualités par société (Sikafinance → news_articles).
// Titre + lien + source uniquement (jamais le contenu), robots.txt respecté par le connecteur.
//
// GET /api/cron/refresh-news?after=SNTS&maxTickers=12&budgetMs=240000

import { prisma } from "../prisma";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import { toNewsRows } from "../news/normalize";

export interface NewsRefreshOptions {
  tickers?: string[];
  /** Reprend APRÈS ce ticker (ordre alphabétique). */
  after?: string;
  maxTickers?: number;
  timeBudgetMs?: number;
  logger?: (msg: string) => void;
}

export interface NewsRefreshSummary {
  processed: number;
  inserted: number;
  failed: string[];
  lastTicker: string | null;
  done: boolean;
}

export function parseNewsRefreshSearchParams(sp: URLSearchParams): NewsRefreshOptions {
  const tickers = sp.get("tickers")?.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const num = (k: string) => {
    const n = Number(sp.get(k));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    tickers: tickers?.length ? tickers : undefined,
    after: sp.get("after")?.trim().toUpperCase() || undefined,
    maxTickers: num("maxTickers"),
    timeBudgetMs: num("budgetMs"),
  };
}

export async function runNewsRefresh(options: NewsRefreshOptions = {}): Promise<NewsRefreshSummary> {
  const log = options.logger ?? (() => {});
  const maxTickers = Math.min(options.maxTickers ?? 12, 60);
  const budget = Math.min(options.timeBudgetMs ?? 240_000, 280_000);
  const started = Date.now();

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      exchange: "BRVM",
      ...(options.tickers ? { ticker: { in: options.tickers } } : {}),
      ...(options.after && !options.tickers ? { ticker: { gt: options.after } } : {}),
    },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });

  const summary: NewsRefreshSummary = { processed: 0, inserted: 0, failed: [], lastTicker: null, done: true };
  for (const company of companies) {
    if (summary.processed >= maxTickers || Date.now() - started > budget) {
      summary.done = false;
      break;
    }
    summary.processed += 1;
    summary.lastTicker = company.ticker;
    const res = await sikafinanceConnector.fetchCompanyNews(company.ticker);
    if (!res.ok) {
      summary.failed.push(company.ticker);
      log(`${company.ticker}: ${res.error}`);
      continue;
    }
    const rows = toNewsRows(company, res.data, new Date());
    if (rows.length === 0) continue;
    const created = await prisma.newsArticle.createMany({ data: rows, skipDuplicates: true });
    summary.inserted += created.count;
    log(`${company.ticker}: +${created.count}/${rows.length}`);
  }
  return summary;
}
