// Parseur de fiche SOCIETE Sikafinance (`/marches/societe/{TICKER.cc}`).
// Testable sans réseau. Unités : la page indique « Les chiffres sont en
// millions de FCFA » — CA / RN convertis en milliards (unité FinancialRatio).
// Sans cette mention, on ne persiste PAS CA/RN (pas d'unité inventée) ;
// PER, croissance et dividendes restent exploitables.

import * as cheerio from "cheerio";
import { parseFrenchNumber } from "./parse-utils";
import type { RawCompanyFundamentals, RawCompanyProfile, RawDividendRow } from "./types";

const ISIN_RE = /\b([A-Z]{2}\d{10})\b/;

export function millionsFcfaToMds(millions: number): number {
  return Math.round((millions / 1000) * 100) / 100;
}

function findRow(
  byLabel: Map<string, string[]>,
  pred: (label: string) => boolean
): string[] | undefined {
  for (const [label, row] of byLabel) {
    if (pred(label)) return row;
  }
  return undefined;
}

export function parseSikaCompanySheetHtml(
  html: string,
  ticker: string,
  fetchedAt: string,
  asOf = new Date()
): {
  profile: RawCompanyProfile;
  fundamentals: RawCompanyFundamentals[];
  dividends: RawDividendRow[];
} {
  const t = ticker.toUpperCase();
  const $ = cheerio.load(html);
  const pageText = $("body").text().replace(/\s+/g, " ");
  const currentYear = asOf.getUTCFullYear();

  const isinMatch = pageText.match(ISIN_RE);
  const isin = isinMatch?.[1] ?? null;

  let description: string | null = null;
  const descMatch = pageText.match(
    /La société\s*:\s*(.+?)(?=\s*(?:Téléphone|Fax|Adresse|Dirigeants|Nombre de titres|Flottant|Valorisation)\s*:)/i
  );
  if (descMatch) description = descMatch[1]!.replace(/\s+/g, " ").trim();

  const phone =
    pageText.match(/Téléphone\s*:\s*(\(\+\d+\)[\d\s\-–]+|\+?[\d\s\-–()]{8,})/i)?.[1]?.trim() ?? null;
  const fax =
    pageText.match(/Fax\s*:\s*(\(\+\d+\)[\d\s\-–]+|\+?[\d\s\-–()]{8,})/i)?.[1]?.trim() ?? null;
  const address =
    pageText
      .match(/Adresse\s*:\s*(.+?)(?=\s*(?:Dirigeants|Nombre de titres|Flottant|Téléphone|Fax)\s*:)/i)?.[1]
      ?.trim() ?? null;
  const directors =
    pageText
      .match(/Dirigeants\s*:\s*(.+?)(?=\s*(?:Nombre de titres|Flottant|Valorisation|Principaux)\s*:)/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? null;

  let sharesOutstanding: number | null = null;
  const sharesMatch = pageText.match(/Nombre de titres\s*:\s*([\d\s\u00a0]+)/i);
  if (sharesMatch) sharesOutstanding = parseFrenchNumber(sharesMatch[1]!.replace(/\s/g, " "));

  let floatPercent: number | null = null;
  const floatMatch = pageText.match(/Flottant\s*:\s*([\d.,]+)\s*%/i);
  if (floatMatch) floatPercent = parseFrenchNumber(floatMatch[1]!);

  let mktCapMds: number | null = null;
  let valuationLabel: string | null = null;
  const valoMatch = pageText.match(
    /Valorisation de la société\s*:\s*([\d\s\u00a0]+)\s*(MFCFA|Md[s]?\s*FCFA)?/i
  );
  if (valoMatch) {
    valuationLabel = `${valoMatch[1]!.replace(/\s+/g, " ").trim()}${valoMatch[2] ? ` ${valoMatch[2]}` : ""}`;
    const mfcfa = parseFrenchNumber(valoMatch[1]!.replace(/\s/g, " "));
    if (mfcfa != null && mfcfa > 0) {
      const unit = (valoMatch[2] ?? "MFCFA").toUpperCase();
      mktCapMds = unit.includes("MFCFA")
        ? Math.round((mfcfa / 1000) * 100) / 100
        : Math.round(mfcfa * 100) / 100;
    }
  }

  const shareholders: Array<{ name: string; percent: number | null }> = [];
  const lstRaw =
    $("#lstActionnaires").text().trim() ||
    pageText.match(/lstActionnaires[^>]*>([^<]+)/i)?.[1]?.trim() ||
    "";
  if (lstRaw) {
    for (const part of lstRaw.split(";")) {
      const [namePart, pctPart] = part.split("*");
      const name = (namePart ?? "").trim();
      if (!name) continue;
      const percent = pctPart != null ? parseFrenchNumber(pctPart) : null;
      shareholders.push({ name, percent });
    }
  }

  const figuresInMillions = /chiffres sont en millions de FCFA/i.test(pageText);

  const fundamentals: RawCompanyFundamentals[] = [];
  const dividends: RawDividendRow[] = [];

  $("table").each((_, table) => {
    const rows = $(table)
      .find("tr")
      .toArray()
      .map((tr) =>
        $(tr)
          .find("th,td")
          .toArray()
          .map((c) => $(c).text().replace(/\u00a0/g, " ").trim())
      );
    if (rows.length < 2) return;
    const header = rows[0]!;
    const yearIdx: Array<{ col: number; year: number }> = [];
    header.forEach((cell, col) => {
      const y = Number(cell);
      if (y >= 1990 && y <= 2100) yearIdx.push({ col, year: y });
    });
    if (yearIdx.length === 0) return;

    const byLabel = new Map<string, string[]>();
    for (const row of rows.slice(1)) {
      const label = (row[0] ?? "").toLowerCase();
      if (!label) continue;
      byLabel.set(label, row);
    }

    for (const { col, year } of yearIdx) {
      const perRow = findRow(byLabel, (l) => l === "per" || l.startsWith("per"));
      const growthRow = findRow(byLabel, (l) => l.includes("croissance ca"));
      const divRow = findRow(byLabel, (l) => l.startsWith("dividende"));
      const rnRow = findRow(
        byLabel,
        (l) => l.includes("résultat net") || l.includes("resultat net")
      );
      const caRow = findRow(byLabel, (l) => l.includes("chiffre"));

      const per = perRow ? parseFrenchNumber(perRow[col] ?? "") : null;
      const revenueGrowth = growthRow ? parseFrenchNumber(growthRow[col] ?? "") : null;
      const divAmt = divRow ? parseFrenchNumber(divRow[col] ?? "") : null;
      const ca = caRow ? parseFrenchNumber(caRow[col] ?? "") : null;
      const rn = rnRow ? parseFrenchNumber(rnRow[col] ?? "") : null;

      let netMargin: number | null = null;
      if (ca != null && ca > 0 && rn != null) {
        netMargin = Math.round((rn / ca) * 10000) / 100;
      }

      const revenue = figuresInMillions && ca != null && ca > 0 ? millionsFcfaToMds(ca) : null;
      const netIncome = figuresInMillions && rn != null ? millionsFcfaToMds(rn) : null;

      if (
        per != null ||
        revenueGrowth != null ||
        netMargin != null ||
        revenue != null ||
        netIncome != null ||
        (year === currentYear && mktCapMds != null)
      ) {
        fundamentals.push({
          ticker: t,
          year,
          per,
          mktCapMds: year === currentYear ? mktCapMds : null,
          closePrice: null,
          source: "SIKAFINANCE",
          fetchedAt,
          revenueGrowth,
          netMargin,
          revenue,
          netIncome,
        });
      }
      if (divAmt != null && divAmt > 0) {
        dividends.push({ ticker: t, year, amount: divAmt, source: "SIKAFINANCE", fetchedAt });
      }
    }
  });

  // Valorisation du jour (pas un exercice) : collée à l'année civile courante,
  // même si le tableau s'arrête à N-1 (cas Sika en cours d'année).
  if (mktCapMds != null) {
    const current = fundamentals.find((f) => f.year === currentYear);
    if (current) {
      current.mktCapMds = mktCapMds;
    } else {
      fundamentals.push({
        ticker: t,
        year: currentYear,
        per: null,
        mktCapMds,
        closePrice: null,
        source: "SIKAFINANCE",
        fetchedAt,
      });
    }
  }

  const profile: RawCompanyProfile = {
    ticker: t,
    isin,
    description,
    sharesOutstanding,
    floatPercent,
    phone,
    fax,
    address,
    directors,
    valuationLabel,
    shareholders,
    source: "SIKAFINANCE",
    fetchedAt,
  };

  return { profile, fundamentals, dividends };
}
