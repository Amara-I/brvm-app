import { fetchBuffer, fetchJson, HttpFetchError } from "@/lib/ingestion/http-client";
import { parseCoverPageText, type NgxCoverSnapshot } from "./cover-page";
import { matchSummaryToListings, parseDailySummaryText, type NamedListing } from "./daily-summary";
import { isoDate, recentWeekdays } from "./dates";
import { parseEquitiesPayload } from "./equities-json";
import type { NgxEquitiesKind, NgxListingQuote } from "./listing-quote";
import { parseOfficialListItems, parseOfficialListText, type OfficialListRow } from "./official-list";
import { extractNgxPdfItems, extractNgxPdfText } from "./pdf-text";
import { ngxCoverPdfUrl, ngxDailySummaryPdfUrl, ngxEquitiesJsonUrl, ngxOfficialListPdfUrl } from "./urls";

export interface LoadEquitiesOptions {
  now?: Date;
  walkbackDays?: number;
  deadlineMs?: number;
  listings?: NamedListing[];
  /** Backfill : une date, sans le JSON « séance du jour ». */
  onlyDate?: string;
  allowJson?: boolean;
}

export type LoadEquitiesResult =
  | { ok: true; date: string; quotes: NgxListingQuote[]; kind: NgxEquitiesKind; warnings: string[] }
  | { ok: false; absent: boolean; warnings: string[] };

function expired(deadlineMs: number | undefined): boolean {
  return deadlineMs != null && Date.now() > deadlineMs;
}

async function pdfText(url: string): Promise<{ text: string } | { missing: true } | { error: string }> {
  try {
    const buf = await fetchBuffer(url, { cacheTtlMs: 36 * 60 * 60 * 1000, timeoutMs: 25_000 });
    if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return { error: `réponse non PDF ${url}` };
    }
    const text = await extractNgxPdfText(new Uint8Array(buf));
    if (text.replace(/\s+/g, "").length < 40) return { error: `PDF sans texte ${url}` };
    return { text };
  } catch (err) {
    if (err instanceof HttpFetchError && (err.httpStatus === 404 || err.httpStatus === 401)) {
      return { missing: true };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

function fromOfficial(rows: OfficialListRow[], iso: string): NgxListingQuote[] {
  return rows
    .filter((row) => row.tradeDate === iso && row.close > 0)
    .map((row) => ({
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      board: row.board,
      close: row.close,
      prevClose: null,
      changePercent: null,
      volume: row.volume,
      tradeDate: iso,
    }));
}

function fromSummary(text: string, iso: string, listings: NamedListing[]): NgxListingQuote[] {
  const matched = matchSummaryToListings(parseDailySummaryText(text), listings);
  return matched.map((row) => ({
    symbol: row.ticker,
    name: row.name,
    sector: row.sector,
    board: row.board,
    close: row.close,
    prevClose: null,
    changePercent: row.changePercent,
    volume: row.volume,
    tradeDate: iso,
  }));
}

async function officialListRows(iso: string): Promise<{ rows: ReturnType<typeof parseOfficialListText> } | { missing: true } | { error: string }> {
  const url = ngxOfficialListPdfUrl(iso);
  try {
    const buf = await fetchBuffer(url, { cacheTtlMs: 36 * 60 * 60 * 1000, timeoutMs: 25_000 });
    if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return { error: `réponse non PDF ${url}` };
    }
    const bytes = new Uint8Array(buf);
    const byColumn = parseOfficialListItems(await extractNgxPdfItems(bytes));
    if (byColumn.length >= 30) return { rows: byColumn };
    const text = await extractNgxPdfText(bytes);
    if (text.replace(/\s+/g, "").length < 40) return { error: `PDF sans texte ${url}` };
    return { rows: parseOfficialListText(text) };
  } catch (err) {
    if (err instanceof HttpFetchError && (err.httpStatus === 404 || err.httpStatus === 401)) {
      return { missing: true };
    }
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function loadPdfsForDate(
  iso: string,
  listings: NamedListing[],
  warnings: string[]
): Promise<{ quotes: NgxListingQuote[]; kind: NgxEquitiesKind } | { absent: boolean }> {
  const official = await officialListRows(iso);
  if ("rows" in official) {
    const quotes = fromOfficial(official.rows, iso);
    if (quotes.length >= 30) return { quotes, kind: "official-list" };
    warnings.push(`${iso} liste officielle : ${quotes.length} cours exploitables`);
  } else if ("error" in official) {
    warnings.push(`${iso} liste officielle : ${official.error}`);
  }

  const summary = await pdfText(ngxDailySummaryPdfUrl(iso));
  if ("text" in summary) {
    const quotes = fromSummary(summary.text, iso, listings);
    if (quotes.length >= 30) return { quotes, kind: "daily-summary" };
    warnings.push(`${iso} daily summary : ${quotes.length} noms appariés`);
  } else if ("error" in summary) {
    warnings.push(`${iso} daily summary : ${summary.error}`);
  }

  return { absent: "missing" in official && "missing" in summary };
}

export async function loadNgxEquities(options: LoadEquitiesOptions = {}): Promise<LoadEquitiesResult> {
  const now = options.now ?? new Date();
  const warnings: string[] = [];
  const listings = options.listings ?? [];

  if (!options.onlyDate && options.allowJson !== false) {
    if (expired(options.deadlineMs)) return { ok: false, absent: false, warnings: ["budget temps épuisé"] };
    try {
      const payload = await fetchJson<unknown>(ngxEquitiesJsonUrl(), { cacheTtlMs: 5 * 60 * 1000 });
      const parsed = parseEquitiesPayload(payload, now);
      if (parsed.ok && parsed.tradeDate) {
        return {
          ok: true,
          date: parsed.tradeDate,
          kind: "json",
          warnings,
          quotes: parsed.rows.map((row) => ({
            symbol: row.symbol,
            name: row.name,
            sector: row.sector,
            board: row.board,
            close: row.close,
            prevClose: row.prevClose,
            changePercent: row.changePercent,
            volume: row.volume != null ? Math.round(row.volume) : null,
            tradeDate: row.tradeDate,
          })),
        };
      }
      warnings.push(`JSON NGX rejeté : ${parsed.reasons.join(" ; ") || "sanity"}`);
    } catch (err) {
      warnings.push(`JSON NGX indisponible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const days = options.onlyDate
    ? [options.onlyDate.slice(0, 10)]
    : recentWeekdays(isoDate(now), options.walkbackDays ?? 6);

  let sawMissing = false;
  for (const iso of days) {
    if (expired(options.deadlineMs)) {
      warnings.push("budget temps épuisé pendant le repli PDF");
      return { ok: false, absent: false, warnings };
    }
    try {
      const loaded = await loadPdfsForDate(iso, listings, warnings);
      if ("quotes" in loaded) {
        return { ok: true, date: iso, quotes: loaded.quotes, kind: loaded.kind, warnings };
      }
      if (loaded.absent) sawMissing = true;
    } catch (err) {
      warnings.push(`${iso} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: false, absent: Boolean(options.onlyDate) && sawMissing, warnings };
}

export async function loadNgxCover(options: {
  now?: Date;
  onlyDate?: string;
  walkbackDays?: number;
  deadlineMs?: number;
} = {}): Promise<{ ok: true; snapshot: NgxCoverSnapshot; warnings: string[] } | { ok: false; absent: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const days = options.onlyDate
    ? [options.onlyDate.slice(0, 10)]
    : recentWeekdays(isoDate(options.now ?? new Date()), options.walkbackDays ?? 6);
  let missing = false;
  for (const iso of days) {
    if (expired(options.deadlineMs)) return { ok: false, absent: false, warnings: ["budget temps épuisé"] };
    const pdf = await pdfText(ngxCoverPdfUrl(iso));
    if ("missing" in pdf) {
      missing = true;
      continue;
    }
    if ("error" in pdf) {
      warnings.push(`${iso} couverture : ${pdf.error}`);
      continue;
    }
    const snapshot = parseCoverPageText(pdf.text);
    if (!snapshot) {
      warnings.push(`${iso} couverture illisible`);
      continue;
    }
    return { ok: true, snapshot, warnings };
  }
  return { ok: false, absent: Boolean(options.onlyDate) && missing, warnings };
}
