import * as cheerio from "cheerio";
import { parseFrenchNumber } from "./parse-utils";
import type { RawDividendRow } from "./types";

function isoFromDrupalContent(content: string | undefined): string | null {
  if (!content) return null;
  const m = content.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function yearFromDrupalContent(content: string | undefined, fallbackText: string): number | null {
  const iso = isoFromDrupalContent(content);
  if (iso) return Number(iso.slice(0, 4));
  const y = Number(fallbackText.trim());
  return Number.isFinite(y) && y >= 1990 && y <= 2100 ? y : null;
}

/** Parse une page HTML du calendrier BRVM « paiement-de-dividendes ». */
export function parseBrvmDividendPage(
  html: string,
  fetchedAt: string,
  resolveTicker: (issuerLabel: string) => string | null
): RawDividendRow[] {
  const $ = cheerio.load(html);
  const rows: RawDividendRow[] = [];

  $("table.views-table tbody tr").each((_, tr) => {
    const issuer = $(tr).find(".views-field-field-emetteur-esv").text().trim();
    if (!issuer) return;

    const yearCell = $(tr).find(".views-field-field-exercice-comptable-esv");
    const year = yearFromDrupalContent(
      yearCell.find("span[content]").attr("content"),
      yearCell.text()
    );
    if (!year) return;

    const amountText = $(tr).find(".views-field-field-montant-du-dividende-net").text();
    const amount = parseFrenchNumber(amountText.replace(/\s*FCFA\s*/gi, ""));
    if (amount === null || !(amount > 0)) return;

    const ticker = resolveTicker(issuer);
    if (!ticker) return;

    const paymentDate = isoFromDrupalContent(
      $(tr).find(".views-field-field-date-de-paiement-esv span[content]").attr("content")
    );
    const exDate = isoFromDrupalContent(
      $(tr).find(".views-field-field-date-ex-dividende span[content]").attr("content")
    );

    rows.push({
      ticker,
      year,
      amount,
      source: "BRVM_OFFICIEL",
      fetchedAt,
      exDate,
      paymentDate,
    });
  });

  return rows;
}

/** Fusionne les lignes BRVM — une entrée par ticker + exercice (dernière page l'emporte). */
export function mergeBrvmDividendRows(rows: RawDividendRow[]): RawDividendRow[] {
  const byKey = new Map<string, RawDividendRow>();
  for (const row of rows) {
    byKey.set(`${row.ticker}:${row.year}`, row);
  }
  return [...byKey.values()];
}
