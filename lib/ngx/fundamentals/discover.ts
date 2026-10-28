import type { NgxDocType, NgxListItem, NgxManifestEntry, NgxCompanyConfig } from "./types";

export const NGX_DOCLIB_BASE = "https://doclib.ngxgroup.com";

/** URL REST SharePoint listant les dépôts d'un symbole (liste officielle `XFinancial_News`). */
export function buildListUrl(symbol: string, top = 500): string {
  const select = "URL,Created,CompanyName,CompanySymbol,Type_of_Submission";
  const filter = `CompanySymbol eq '${symbol.replace(/'/g, "''")}'`;
  return (
    `${NGX_DOCLIB_BASE}/_api/Web/Lists/GetByTitle('XFinancial_News')/items/` +
    `?$select=${select}&$filter=${encodeURIComponent(filter)}&$orderby=Created%20desc&$top=${top}`
  );
}

const INTERIM_RE =
  /\bQ[1-3]\b|QUARTER\s*[1-3]\b|FIRST QUARTER|THIRD QUARTER|SECOND QUARTER|HALF|\bH1\b|\bHY\b|9\s*M|NINE|THREE MONTHS|SIX MONTHS|1ST|2ND|3RD|INTERIM|UNAUDITED/;
const FULLYEAR_RE = /FULL YEAR|YEAR ENDED|ANNUAL REPORT/;

/** Classe un dépôt : états audités, rapport annuel, communiqué de résultats annuels, ou null (trimestriel…). */
export function classifyDocument(item: NgxListItem): NgxDocType | null {
  const title = (item.URL.Description ?? "").toUpperCase();
  const submission = (item.Type_of_Submission ?? "").trim();
  if (!["Financial Statements", "Corporate Actions", "Corporate Action"].includes(submission)) return null;
  if (INTERIM_RE.test(title) && !FULLYEAR_RE.test(title)) return null;
  if (title.includes("EARNING") && title.includes("RELEASE")) {
    return /FULL YEAR|\bFY\b|ANNUAL|YEAR/.test(title) ? "EARNINGS_RELEASE" : null;
  }
  if (/ANNUAL REPORT|ANNUAL & SUSTAIN|ANNUAL AND SUSTAIN|INTEGRATED REPORT|COMBINED ANNUAL/.test(title)) return "ANNUAL_REPORT";
  if (submission === "Financial Statements" && /AUDITED|YEAR|DEC|FINAL|ANNUAL|AFS|\bFY\b|ACCT|ACCOUNT|\bQ4\b|QUARTER 4|QUARTER 5/.test(title)) {
    return "AUDITED_FS";
  }
  return null;
}

/** Exercice supposé : année citée dans le titre (≤ année de dépôt), sinon d'après la date de dépôt. */
export function guessFiscalYear(item: NgxListItem): number {
  const title = item.URL.Description ?? "";
  const filedYear = Number(item.Created.slice(0, 4));
  const filedMonth = Number(item.Created.slice(5, 7));
  const years = [...title.matchAll(/(?<!\d)(20[01]\d|202\d)(?!\d)/g)].map((m) => Number(m[1])).filter((y) => y >= 2008 && y <= 2027);
  if (years.length) {
    const y = years.length <= 2 ? Math.max(...years) : years[0];
    return y <= filedYear ? y : filedYear;
  }
  return filedMonth <= 7 ? filedYear - 1 : filedYear;
}

function safeFileName(url: string, i: number): string {
  const base = decodeURIComponent(url.split("/").pop() ?? `doc${i}.pdf`)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 120);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/** Construit les entrées du manifeste pour une société à partir des lignes brutes (symboles courant + historiques). */
export function buildManifestEntries(
  company: NgxCompanyConfig,
  itemsBySymbol: Record<string, NgxListItem[]>,
  opts: { fromYear: number; toYear: number },
): NgxManifestEntry[] {
  const seen = new Set<string>();
  const out: NgxManifestEntry[] = [];
  let i = 0;
  for (const symbol of company.symbols) {
    for (const item of itemsBySymbol[symbol] ?? []) {
      const url = item.URL?.Url;
      if (!url || seen.has(url)) continue;
      const docType = classifyDocument(item);
      if (!docType) continue;
      const fy = guessFiscalYear(item);
      if (fy < opts.fromYear || fy > opts.toYear) continue;
      seen.add(url);
      out.push({
        ticker: company.ticker,
        filedSymbol: symbol,
        docType,
        guessedFiscalYear: fy,
        createdAt: item.Created,
        title: item.URL.Description ?? "",
        url,
        file: `${docType}_${fy}_${String(i++).padStart(2, "0")}_${safeFileName(url, i)}`,
      });
    }
  }
  return out.sort((a, b) => a.docType.localeCompare(b.docType) || a.guessedFiscalYear - b.guessedFiscalYear || a.createdAt.localeCompare(b.createdAt));
}
