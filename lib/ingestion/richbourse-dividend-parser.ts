import * as cheerio from "cheerio";
import { parseDdMmYyyy, parseFrenchNumber } from "./parse-utils";
import type { RawDividendRow } from "./types";

export interface RichbourseSimDividend {
  ticker: string;
  name: string;
  amount: number;
  exDate: string | null;
  paymentDate: string | null;
  /** true si dates officielles (avis BRVM) selon Richbourse. */
  official: boolean;
}

function parseRbSimData(html: string): RichbourseSimDividend[] {
  const m = html.match(/window\.rbSimData\s*=\s*(\[.*?\]);/s);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]!);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const rows: RichbourseSimDividend[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const ticker = String(o.s ?? "").toUpperCase();
    const amount = Number(o.m);
    if (!ticker || !Number.isFinite(amount) || !(amount > 0)) continue;
    rows.push({
      ticker,
      name: String(o.n ?? ticker),
      amount,
      exDate: typeof o.x === "string" && o.x ? o.x : null,
      paymentDate: typeof o.p === "string" && o.p ? o.p : null,
      official: o.o === 1,
    });
  }
  return rows;
}

function parseTableRows(html: string): RichbourseSimDividend[] {
  const $ = cheerio.load(html);
  const rows: RichbourseSimDividend[] = [];
  $("table.t tbody tr").each((_, tr) => {
    const href = $(tr).find('a[href*="/common/mouvements/index/"]').attr("href") ?? "";
    const ticker = href.match(/\/index\/([A-Z0-9]+)/i)?.[1]?.toUpperCase() ?? "";
    if (!ticker) return;
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const amount = parseFrenchNumber(cells[2]?.replace(/%/g, "") ?? "");
    if (amount === null || !(amount > 0)) return;
    const exRaw = cells[4] ?? "";
    const payRaw = cells[5] ?? "";
    const exDate = /inconnue/i.test(exRaw) ? null : parseDdMmYyyy(exRaw);
    const paymentDate = /inconnue/i.test(payRaw) ? null : parseDdMmYyyy(payRaw);
    const unofficial = $(tr).find("span[style*='color:red']").length > 0;
    rows.push({
      ticker,
      name: cells[1] ?? ticker,
      amount,
      exDate,
      paymentDate,
      official: !unofficial && Boolean(exDate && paymentDate),
    });
  });
  return rows;
}

/** Fusionne rbSimData (prioritaire) + tableau HTML Richbourse. */
export function parseRichbourseDividendCalendar(html: string): RichbourseSimDividend[] {
  const byTicker = new Map<string, RichbourseSimDividend>();
  for (const row of parseTableRows(html)) byTicker.set(row.ticker, row);
  for (const row of parseRbSimData(html)) byTicker.set(row.ticker, row);
  return [...byTicker.values()];
}

export function richbourseToRawRows(
  rows: RichbourseSimDividend[],
  calendarYear: number,
  fetchedAt: string
): RawDividendRow[] {
  return rows
    .filter((r) => r.exDate || r.paymentDate)
    .map((r) => ({
      ticker: r.ticker,
      year: calendarYear,
      amount: r.amount,
      source: "RICHBOURSE" as const,
      fetchedAt,
      exDate: r.exDate,
      paymentDate: r.paymentDate,
    }));
}
