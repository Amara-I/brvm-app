// Parseurs Sikafinance (page A–Z, accueil, GetHistos) — testables sans réseau.
// Vérifié le 10/09/2026 :
//   - `#tblShare` sur `/marches/aaz` = toutes les valeurs (Dernier + volume)
//   - `#tabQuotes2` = indices (BRVMC, BRVM30, SIKATR, sectoriels)
//   - `.mkprice` a disparu des pages `/marches/cotation_{TICKER.cc}`

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { findHeaderIndex } from "./html-table";
import { normalizeIndexCode, parseFrenchNumber } from "./parse-utils";
import type { RawIndexQuote, RawPriceQuote } from "./types";

export interface ParsedSikaAazQuote {
  ticker: string;
  sikaSymbol: string;
  closePrice: number;
  volume: number | null;
  changePercent: number | null;
}

export interface ParsedSikaIndex {
  code: string;
  label: string;
  value: number;
  changePercent: number | null;
}

export interface SikaHistoPoint {
  Date: string;
  Open?: number;
  High?: number;
  Low?: number;
  Close: number;
  Volume?: number;
}

function cellTexts($: CheerioAPI, row: AnyNode): string[] {
  return $(row)
    .find("th,td")
    .toArray()
    .map((c) =>
      $(c)
        .text()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
}

/// Mappe TICKER → symbole `TICKER.cc` (ex. SNTS → SNTS.sn) depuis le HTML A–Z.
export function parseSikaSymbolMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /cotation_([A-Z0-9]+)\.([a-z]{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ticker = m[1]!.toUpperCase();
    const cc = m[2]!.toLowerCase();
    map.set(ticker, `${ticker}.${cc}`);
  }
  return map;
}

function parseCotationHref(href: string): { ticker: string; sikaSymbol: string; country?: string } | null {
  const withCc = href.match(/cotation_([A-Z0-9]+)\.([a-z]{2})/i);
  if (withCc) {
    const ticker = withCc[1]!.toUpperCase();
    const cc = withCc[2]!.toLowerCase();
    return { ticker, sikaSymbol: `${ticker}.${cc}`, country: cc };
  }
  const bare = href.match(/cotation_([A-Z0-9-]+)/i);
  if (!bare) return null;
  const slug = bare[1]!.toUpperCase();
  return { ticker: slug, sikaSymbol: slug };
}

/// Tableau des actions `#tblShare` (Ouverture / +Haut / +Bas / Volume / Dernier).
export function parseSikaAazQuotes(html: string): ParsedSikaAazQuote[] {
  const $ = cheerio.load(html);
  let table = $("#tblShare");
  if (table.length === 0) {
    $("table").each((_, el) => {
      if (table.length > 0) return;
      const headerEl = $(el).find("thead tr").first().get(0);
      if (!headerEl) return;
      const headers = cellTexts($, headerEl);
      const closeCol = findHeaderIndex(headers, [/^dernier$/]);
      const volCol = findHeaderIndex(headers, [/volume \(titres\)/, /^volume$/]);
      if (closeCol >= 0 && volCol >= 0) table = $(el);
    });
  }
  if (table.length === 0) return [];

  const headerRow = table.find("thead tr").first().get(0);
  const headers = headerRow ? cellTexts($, headerRow) : [];
  const closeCol = findHeaderIndex(headers, [/^dernier$/]);
  const volumeCol = findHeaderIndex(headers, [/volume \(titres\)/]);
  const changeCol = findHeaderIndex(headers, [/^variation$/]);
  if (closeCol < 0) return [];

  const results: ParsedSikaAazQuote[] = [];
  table.find("tbody tr").each((_, row) => {
    const href = $(row).find("a[href*='cotation_']").attr("href") ?? "";
    const parsed = parseCotationHref(href);
    // Les indices n'ont pas de suffixe pays — on les ignore ici.
    if (!parsed?.country) return;
    const cells = cellTexts($, row);
    const closePrice = parseFrenchNumber(cells[closeCol] ?? "");
    if (closePrice === null || closePrice <= 0) return;
    results.push({
      ticker: parsed.ticker,
      sikaSymbol: parsed.sikaSymbol,
      closePrice,
      volume: volumeCol >= 0 ? parseFrenchNumber(cells[volumeCol] ?? "") : null,
      changePercent: changeCol >= 0 ? parseFrenchNumber(cells[changeCol] ?? "") : null,
    });
  });
  return results;
}

const SKIP_INDEX_SLUGS = new Set(["CAPIBRVM"]);

/// Indices `#tabQuotes2` sur la même page A–Z (BRVMC, BRVM30, sectoriels, SIKATR).
export function parseSikaAazIndices(html: string): ParsedSikaIndex[] {
  const $ = cheerio.load(html);
  let table = $("#tabQuotes2");
  if (table.length === 0) {
    $("table").each((_, el) => {
      if (table.length > 0) return;
      const headerEl = $(el).find("thead tr").first().get(0);
      if (!headerEl) return;
      const headers = cellTexts($, headerEl);
      const closeCol = findHeaderIndex(headers, [/^dernier$/]);
      const nameCol = findHeaderIndex(headers, [/^nom$/]);
      const volCol = findHeaderIndex(headers, [/volume/]);
      if (nameCol >= 0 && closeCol >= 0 && volCol < 0) table = $(el);
    });
  }
  if (table.length === 0) return [];

  const headerRow = table.find("thead tr").first().get(0);
  const headers = headerRow ? cellTexts($, headerRow) : [];
  const closeCol = findHeaderIndex(headers, [/^dernier$/]);
  const changeCol = findHeaderIndex(headers, [/^variation$/]);
  if (closeCol < 0) return [];

  const results: ParsedSikaIndex[] = [];
  const usedCodes = new Set<string>();

  table.find("tbody tr").each((_, row) => {
    const href = $(row).find("a[href*='cotation_']").attr("href") ?? "";
    const parsed = parseCotationHref(href);
    if (!parsed || parsed.country) return;
    if (SKIP_INDEX_SLUGS.has(parsed.ticker)) return;
    const cells = cellTexts($, row);
    const label = $(row).find("a").first().text().replace(/\s+/g, " ").trim() || parsed.ticker;
    const value = parseFrenchNumber(cells[closeCol] ?? "");
    if (value === null || value <= 0) return;
    let code = normalizeIndexCode(label);
    if (!code || usedCodes.has(code)) {
      code = normalizeIndexCode(parsed.ticker);
    }
    if (!code || usedCodes.has(code)) return;
    usedCodes.add(code);
    results.push({
      code,
      label,
      value,
      changePercent: changeCol >= 0 ? parseFrenchNumber(cells[changeCol] ?? "") : null,
    });
  });
  return results;
}

const HOMEPAGE_SLUG_TO_CODE: Record<string, string> = {
  BRVMC: "BRVM_COMPOSITE",
  SIKATR: "SIKA_TOTAL_RETURN",
};

/// Accueil Sikafinance (`.mkcol` / `.mkprice`) — repli si A–Z indisponible.
export function parseSikaHomepageIndices(html: string): ParsedSikaIndex[] {
  const $ = cheerio.load(html);
  const results: ParsedSikaIndex[] = [];
  const seen = new Set<string>();

  $(".mkcol").each((_, col) => {
    const link = $(col).find("a.mkname").first();
    const href = link.attr("href") ?? "";
    const slugMatch = href.match(/cotation_([A-Z0-9]+)/i);
    const slug = slugMatch?.[1]?.toUpperCase();
    const code = slug ? HOMEPAGE_SLUG_TO_CODE[slug] : undefined;
    if (!code || seen.has(code)) return;
    const label = link.text().replace(/\s+/g, " ").trim();
    const value = parseFrenchNumber($(col).find(".mkprice").first().text());
    const changePercent = parseFrenchNumber($(col).find(".mkvar").first().text());
    if (value === null) return;
    seen.add(code);
    results.push({ code, label, value, changePercent });
  });
  return results;
}

export function parseSikaDate(ddmmyyyy: string): { iso: string; year: number } | null {
  const m = ddmmyyyy.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year || month > 12 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const probe = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(probe.getTime())) return null;
  return { iso, year };
}

export function mapSikaHistosToQuotes(
  ticker: string,
  lst: unknown,
  opts: { dateMax?: string; fetchedAt: string }
): RawPriceQuote[] {
  const rows = Array.isArray(lst) ? lst : [];
  const results: RawPriceQuote[] = [];
  for (const pt of rows) {
    if (!pt || typeof pt !== "object") continue;
    const close = (pt as SikaHistoPoint).Close;
    const dateRaw = (pt as SikaHistoPoint).Date;
    if (typeof close !== "number" || close <= 0 || typeof dateRaw !== "string") continue;
    const parsed = parseSikaDate(dateRaw);
    if (!parsed) continue;
    if (opts.dateMax && parsed.iso > opts.dateMax) continue;
    const volume = (pt as SikaHistoPoint).Volume;
    results.push({
      ticker: ticker.toUpperCase(),
      closePrice: close,
      volume: typeof volume === "number" && volume > 0 ? volume : null,
      source: "SIKAFINANCE",
      date: parsed.iso,
      fetchedAt: opts.fetchedAt,
    });
  }
  return results;
}

export function lastHistosQuote(quotes: RawPriceQuote[]): RawPriceQuote | null {
  if (quotes.length === 0) return null;
  return [...quotes].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
}

export function toRawIndexQuotes(
  parsed: ParsedSikaIndex[],
  date: string,
  fetchedAt: string
): RawIndexQuote[] {
  return parsed.map((idx) => ({
    ...idx,
    source: "SIKAFINANCE" as const,
    date,
    fetchedAt,
  }));
}

export function toRawPriceQuotes(
  parsed: ParsedSikaAazQuote[],
  date: string,
  fetchedAt: string
): RawPriceQuote[] {
  return parsed.map((q) => ({
    ticker: q.ticker,
    closePrice: q.closePrice,
    volume: q.volume,
    changePercent: q.changePercent,
    source: "SIKAFINANCE" as const,
    date,
    fetchedAt,
  }));
}
