// Parseurs HTML BRVM.org (indices + cours) — extraits du connecteur pour
// pouvoir tester la structure Drupal sans réseau. Mapping par en-têtes
// (pas d'indices de colonnes figés).

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { findHeaderIndex } from "./html-table";
import { normalizeIndexCode, parseFrenchNumber } from "./parse-utils";
import type { RawIndexQuote, RawPriceQuote } from "./types";

export interface ParsedBrvmQuotesPage {
  tableFound: boolean;
  quotes: Omit<RawPriceQuote, "source" | "fetchedAt">[];
}

export interface ParsedBrvmIndicesPage {
  tableFound: boolean;
  indices: Omit<RawIndexQuote, "source" | "fetchedAt">[];
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

function isQuotesHeader(headers: string[]): boolean {
  const tickerCol = findHeaderIndex(headers, [/^symbole$/, /^ticker$/]);
  const closeCol = findHeaderIndex(headers, [/cours cloture/, /cloture \(fcfa\)/, /^cloture$/]);
  return tickerCol >= 0 && closeCol >= 0;
}

/// Page `/fr/cours-actions/0/0/{date}` : ignore Top 5 / Flop 5 / activité.
export function parseBrvmQuotesPage(html: string, date: string): ParsedBrvmQuotesPage {
  const $ = cheerio.load(html);
  const matches: Cheerio<AnyNode>[] = [];

  $("table").each((_, table) => {
    const headerEl = $(table).find("thead tr").first().get(0);
    if (!headerEl) return;
    const headers = cellTexts($, headerEl);
    if (headers.length === 0) return;
    if (isQuotesHeader(headers)) matches.push($(table));
  });

  const quotesTable = matches[0];
  if (!quotesTable) {
    return { tableFound: false, quotes: [] };
  }

  const headerRow = quotesTable.find("thead tr").first().get(0);
  const headers = headerRow ? cellTexts($, headerRow) : [];
  const tickerCol = findHeaderIndex(headers, [/^symbole$/, /^ticker$/]);
  const volumeCol = findHeaderIndex(headers, [/^volume$/]);
  const prevCol = findHeaderIndex(headers, [/cours veille/, /fermeture precedente/]);
  const closeCol = findHeaderIndex(headers, [/cours cloture/, /cloture \(fcfa\)/, /^cloture$/]);
  const changeCol = findHeaderIndex(headers, [/^variation/, /variation \(%\)/]);

  if (tickerCol < 0 || closeCol < 0) {
    return { tableFound: false, quotes: [] };
  }

  const quotes: ParsedBrvmQuotesPage["quotes"] = [];
  quotesTable.find("tbody tr").each((_, row) => {
    const cells = cellTexts($, row);
    const ticker = (cells[tickerCol] ?? "").toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(ticker)) return;
    const closePrice = parseFrenchNumber(cells[closeCol] ?? "");
    if (closePrice === null || closePrice <= 0) return;
    quotes.push({
      ticker,
      closePrice,
      volume: volumeCol >= 0 ? parseFrenchNumber(cells[volumeCol] ?? "") : null,
      prevClose: prevCol >= 0 ? parseFrenchNumber(cells[prevCol] ?? "") : null,
      changePercent: changeCol >= 0 ? parseFrenchNumber(cells[changeCol] ?? "") : null,
      date,
    });
  });

  return { tableFound: true, quotes };
}

function isIndicesHeader(headers: string[]): boolean {
  const nameCol = findHeaderIndex(headers, [/^nom$/]);
  const closeCol = findHeaderIndex(headers, [/^fermeture$/]);
  return nameCol >= 0 && closeCol >= 0;
}

/// Page `/fr/indices/0/{date}` : 3 blocs `section#block-tools-indices`, avec
/// repli sur tout tableau dont l'en-tête contient Nom + Fermeture.
export function parseBrvmIndicesPage(html: string, date: string): ParsedBrvmIndicesPage {
  const $ = cheerio.load(html);
  const tables: Cheerio<AnyNode>[] = [];

  $("section[id='block-tools-indices'] table").each((_, table) => {
    tables.push($(table));
  });

  if (tables.length === 0) {
    $("table").each((_, table) => {
      const headerEl = $(table).find("thead tr").first().get(0);
      if (!headerEl) return;
      const headers = cellTexts($, headerEl);
      if (isIndicesHeader(headers)) tables.push($(table));
    });
  }

  const indices: ParsedBrvmIndicesPage["indices"] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    const headerRow = table.find("thead tr").first().get(0);
    const headers = headerRow ? cellTexts($, headerRow) : [];
    const nameCol = findHeaderIndex(headers, [/^nom$/]);
    const closeCol = findHeaderIndex(headers, [/^fermeture$/]);
    const changeCol = findHeaderIndex(headers, [/^variation \(%\)$/, /^variation$/]);
    if (nameCol < 0 || closeCol < 0) continue;

    table.find("tbody tr").each((_, row) => {
      const cells = cellTexts($, row);
      const label = cells[nameCol] ?? "";
      const value = parseFrenchNumber(cells[closeCol] ?? "");
      if (!label || value === null) return;
      const code = normalizeIndexCode(label);
      if (!code || seen.has(code)) return;
      seen.add(code);
      indices.push({
        code,
        label,
        value,
        changePercent: changeCol >= 0 ? parseFrenchNumber(cells[changeCol] ?? "") : null,
        date,
      });
    });
  }

  return { tableFound: tables.length > 0, indices };
}
