// ═══════════════════════════════════════════════════════════════════════════
// Connecteur Sikafinance — SOURCE N°2 (source: "SIKAFINANCE")
// ═══════════════════════════════════════════════════════════════════════════
// Endpoints publics confirmés le 12/08/2026 :
//
//   - Indices (accueil) : `.mkcol` → BRVM Composite + SIKA TOTAL RETURN
//   - Cotation : `/marches/cotation_{TICKER}.{cc}` (ex. SNTS.sn, SGBC.ci)
//     — l'ancien chemin sans suffixe pays retourne souvent 404.
//   - Historique : POST `/api/general/GetHistos`
//     body `{ ticker:"SNTS.sn", datedeb, datefin, xperiod }`
//     xperiod "365" = annuel ; "30" = mensuel ; "0" = journalier
//     (journalier limité ~89 jours sinon erreur API `toolong` — chunker).
  //   - Fiche SOCIETE : `/marches/societe/{TICKER.cc}` (ISIN, description,
  //     tableau CA/RN/PER/dividendes, valorisation, actionnaires).
  //   - Actualités valeur : `/marches/news_valeur?s={TICKER.cc}`
  //   - Événements : `/marches/events/{TICKER.cc}`
  //   - Historiques (page) : `/marches/historiques/{TICKER.cc}` — l'API GetHistos
  //     reste la voie d'ingestion des cours (cf. fetchAnnualHistory / daily).
  //   - Liste des suffixes pays : `/marches/aaz` (cotation_TICKER.cc)
  //
  // robots.txt : Disallow `/listes/displaylist`, `/portif/displayp`, `/docs/*`
  // — les chemins ci-dessus sont autorisés (pas de scrape /docs).
  // ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { fetchHtml, fetchJson, HttpFetchError } from "../http-client";
import { parseFrenchNumber, parseDdMmYyyy, toIsoDate, lastBusinessDay } from "../parse-utils";
import type {
  ConnectorResult,
  MarketDataConnector,
  RawCompanyFundamentals,
  RawCompanyNewsItem,
  RawCompanyEventItem,
  RawCompanyProfile,
  RawDividendRow,
  RawIndexQuote,
  RawPriceQuote,
} from "../types";

const BASE_URL = "https://www.sikafinance.com";
const HISTOS_URL = `${BASE_URL}/api/general/GetHistos`;
const AAZ_URL = `${BASE_URL}/marches/aaz`;

/** Fenêtre max journalière avant erreur API `toolong` (~90–100 jours). */
const DAILY_CHUNK_DAYS = 89;

const SLUG_TO_INDEX_CODE: Record<string, string> = {
  BRVMC: "BRVM_COMPOSITE",
  SIKATR: "SIKA_TOTAL_RETURN",
};

interface SikaHistoPoint {
  Date: string; // DD/MM/YYYY
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

interface SikaHistosResponse {
  lst?: SikaHistoPoint[] | "";
  error?: string;
}

let cachedSikaSymbols: Map<string, string> | null = null;

/// Mappe TICKER → symbole Sikafinance `TICKER.cc` (ex. SNTS → SNTS.sn).
export async function loadSikaSymbolMap(): Promise<Map<string, string>> {
  if (cachedSikaSymbols) return cachedSikaSymbols;
  const html = await fetchHtml(AAZ_URL, { cacheTtlMs: 24 * 60 * 60 * 1000 });
  const map = new Map<string, string>();
  const re = /cotation_([A-Z0-9]+)\.([a-z]{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ticker = m[1]!.toUpperCase();
    const cc = m[2]!.toLowerCase();
    map.set(ticker, `${ticker}.${cc}`);
  }
  cachedSikaSymbols = map;
  return map;
}

function parseSikaDate(ddmmyyyy: string): { iso: string; year: number } | null {
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

/// Pour une série annuelle : stocke au 31/12 de l'année (années passées)
/// pour coller au seed / agrégation dashboard.
/// Année courante : toujours ancrée à `asOf` — l'API Sika date souvent le
/// point YTD au 01/01 avec un cours aberrant, ce qui crée un pic isolé au
/// milieu de la densification journalière (ex. SNTS 36980 @ 2026-01-01).
export function annualPointStorageDate(apiDate: string, asOf = new Date()): string | null {
  const parsed = parseSikaDate(apiDate);
  if (!parsed) return null;
  const currentYear = asOf.getUTCFullYear();
  if (parsed.year < currentYear) return `${parsed.year}-12-31`;
  if (parsed.year > currentYear) return null;
  return toIsoDate(asOf);
}

export class SikafinanceConnector implements MarketDataConnector {
  readonly source = "SIKAFINANCE" as const;

  async fetchIndices(date?: string): Promise<ConnectorResult<RawIndexQuote[]>> {
    const isoDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();

    try {
      const html = await fetchHtml(BASE_URL);
      const $ = cheerio.load(html);
      const results: RawIndexQuote[] = [];

      $(".mkcol").each((_, col) => {
        const link = $(col).find("a.mkname");
        const href = link.attr("href") ?? "";
        const slugMatch = href.match(/cotation_([A-Z0-9]+)/i);
        const slug = slugMatch?.[1]?.toUpperCase();
        const code = slug ? SLUG_TO_INDEX_CODE[slug] : undefined;
        if (!code) return;

        const label = link.text().trim();
        const value = parseFrenchNumber($(col).find(".mkprice").first().text());
        const changePercent = parseFrenchNumber($(col).find(".mkvar").first().text());
        if (value === null) return;

        results.push({ code, label, value, changePercent, source: this.source, date: isoDate, fetchedAt });
      });

      if (results.length === 0) {
        return {
          ok: false,
          source: this.source,
          error: "Aucun indice trouvé sur la page d'accueil — structure HTML probablement modifiée",
          fetchedAt,
        };
      }
      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return { ok: false, source: this.source, error: err instanceof Error ? err.message : String(err), fetchedAt };
    }
  }

  async fetchQuotes(tickers: string[], date?: string): Promise<ConnectorResult<RawPriceQuote[]>> {
    const isoDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();
    const results: RawPriceQuote[] = [];

    let symbols: Map<string, string>;
    try {
      symbols = await loadSikaSymbolMap();
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: `Impossible de charger la liste A–Z Sikafinance: ${err instanceof Error ? err.message : String(err)}`,
        fetchedAt,
      };
    }

    for (const ticker of tickers) {
      const t = ticker.toUpperCase();
      const sikaSym = symbols.get(t);
      if (!sikaSym) continue;
      const url = `${BASE_URL}/marches/cotation_${sikaSym}`;
      try {
        const html = await fetchHtml(url, { checkRobots: true });
        const $ = cheerio.load(html);
        const value = parseFrenchNumber($(".mkprice").first().text());
        if (value !== null) {
          results.push({
            ticker: t,
            closePrice: value,
            volume: null,
            source: this.source,
            date: isoDate,
            fetchedAt,
          });
        }
      } catch (err) {
        const status = err instanceof HttpFetchError ? err.httpStatus : undefined;
        if (status !== 404) {
          // Autre erreur : on continue les autres tickers (non bloquant).
          console.warn(`[sikafinance] ${t}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return { ok: true, source: this.source, data: results, fetchedAt };
  }

  /**
   * Historique annuel (xperiod=365) via GetHistos — source principale pour
   * densifier les années manquantes en base.
   */
  async fetchAnnualHistory(
    ticker: string,
    fromYear = 2000,
    toDate = toIsoDate(new Date())
  ): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fetchedAt = new Date().toISOString();
    const t = ticker.toUpperCase();

    try {
      const symbols = await loadSikaSymbolMap();
      const sikaSym = symbols.get(t);
      if (!sikaSym) {
        return {
          ok: false,
          source: this.source,
          error: `Ticker ${t} introuvable sur Sikafinance (A–Z)`,
          fetchedAt,
        };
      }

      const payload = {
        ticker: sikaSym,
        datedeb: `${fromYear}-01-01`,
        datefin: toDate,
        xperiod: "365",
      };

      const json = await fetchJson<SikaHistosResponse>(HISTOS_URL, {
        method: "POST",
        body: payload,
        cacheTtlMs: 6 * 60 * 60 * 1000,
      });

      if (json.error) {
        return {
          ok: false,
          source: this.source,
          error: `GetHistos ${sikaSym}: ${json.error}`,
          fetchedAt,
        };
      }

      const lst = Array.isArray(json.lst) ? json.lst : [];
      const results: RawPriceQuote[] = [];
      for (const pt of lst) {
        if (!pt || typeof pt.Close !== "number" || pt.Close <= 0) continue;
        const storageDate = annualPointStorageDate(pt.Date);
        if (!storageDate || storageDate > toDate) continue;
        results.push({
          ticker: t,
          closePrice: pt.Close,
          volume: typeof pt.Volume === "number" && pt.Volume > 0 ? pt.Volume : null,
          source: this.source,
          date: storageDate,
          fetchedAt,
        });
      }

      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }

  /**
   * Historique GetHistos générique (xperiod: "0" jour, "30" mois, "365" an…).
   * Pour le journalier, respecter DAILY_CHUNK_DAYS sinon l'API renvoie `toolong`.
   */
  async fetchHistos(
    ticker: string,
    datedeb: string,
    datefin: string,
    xperiod: "0" | "5" | "30" | "91" | "365" = "0"
  ): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fetchedAt = new Date().toISOString();
    const t = ticker.toUpperCase();
    try {
      const symbols = await loadSikaSymbolMap();
      const sikaSym = symbols.get(t);
      if (!sikaSym) {
        return { ok: false, source: this.source, error: `Ticker ${t} introuvable sur Sikafinance (A–Z)`, fetchedAt };
      }

      const json = await fetchJson<SikaHistosResponse>(HISTOS_URL, {
        method: "POST",
        body: { ticker: sikaSym, datedeb, datefin, xperiod },
        cacheTtlMs: xperiod === "0" ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000,
      });

      if (json.error) {
        return {
          ok: false,
          source: this.source,
          error: `GetHistos ${sikaSym} (${xperiod}): ${json.error}`,
          fetchedAt,
        };
      }

      const lst = Array.isArray(json.lst) ? json.lst : [];
      const results: RawPriceQuote[] = [];
      for (const pt of lst) {
        if (!pt || typeof pt.Close !== "number" || pt.Close <= 0) continue;
        const parsed = parseSikaDate(pt.Date);
        if (!parsed || parsed.iso > datefin) continue;
        results.push({
          ticker: t,
          closePrice: pt.Close,
          volume: typeof pt.Volume === "number" && pt.Volume > 0 ? pt.Volume : null,
          source: this.source,
          date: parsed.iso,
          fetchedAt,
        });
      }
      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }

  /** Historique mensuel (xperiod=30) — densifie sans saturer l'API. */
  async fetchMonthlyHistory(
    ticker: string,
    fromYear = 2015,
    toDate = toIsoDate(new Date())
  ): Promise<ConnectorResult<RawPriceQuote[]>> {
    return this.fetchHistos(ticker, `${fromYear}-01-01`, toDate, "30");
  }

  /**
   * Historique journalier par fenêtres de ~89 jours (évite `toolong`).
   * Couvre [fromIso, toIso] inclus.
   */
  async fetchDailyHistoryChunked(
    ticker: string,
    fromIso: string,
    toIso = toIsoDate(new Date())
  ): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fetchedAt = new Date().toISOString();
    const all: RawPriceQuote[] = [];
    let cursor = new Date(`${fromIso}T00:00:00.000Z`);
    const end = new Date(`${toIso}T00:00:00.000Z`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
      return { ok: false, source: this.source, error: "Plage de dates invalide", fetchedAt };
    }

    while (cursor <= end) {
      const chunkEnd = new Date(cursor);
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + DAILY_CHUNK_DAYS);
      if (chunkEnd > end) chunkEnd.setTime(end.getTime());
      const datedeb = toIsoDate(cursor);
      const datefin = toIsoDate(chunkEnd);
      const part = await this.fetchHistos(ticker, datedeb, datefin, "0");
      if (!part.ok) {
        // Une fenêtre vide / toolong : on avance quand même.
        if (!part.error.includes("toolong") && !part.error.includes("introuvable")) {
          console.warn(`[sikafinance] daily ${ticker} ${datedeb}→${datefin}: ${part.error}`);
        }
      } else {
        all.push(...part.data);
      }
      cursor = new Date(chunkEnd);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Déduplique par date (dernier gagne).
    const byDate = new Map<string, RawPriceQuote>();
    for (const q of all) byDate.set(q.date, q);
    return { ok: true, source: this.source, data: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), fetchedAt };
  }

  /**
   * Page SOCIETE : profil (ISIN, description) + tableau pluriannuel
   * (CA, croissance, RN, PER, dividende) + capitalisation si publiée.
   */
  async fetchCompanySheet(ticker: string): Promise<
    ConnectorResult<{
      profile: RawCompanyProfile;
      fundamentals: RawCompanyFundamentals[];
      dividends: RawDividendRow[];
    }>
  > {
    const fetchedAt = new Date().toISOString();
    const t = ticker.toUpperCase();
    try {
      const symbols = await loadSikaSymbolMap();
      const sikaSym = symbols.get(t);
      if (!sikaSym) {
        return { ok: false, source: this.source, error: `Ticker ${t} introuvable sur Sikafinance (A–Z)`, fetchedAt };
      }

      const url = `${BASE_URL}/marches/societe/${sikaSym}`;
      const html = await fetchHtml(url, { checkRobots: true, cacheTtlMs: 12 * 60 * 60 * 1000 });
      const $ = cheerio.load(html);
      const pageText = $("body").text().replace(/\s+/g, " ");

      const isinMatch = pageText.match(/\b([A-Z]{2}\d{10})\b/);
      let isin = isinMatch?.[1] ?? null;
      if (!isin) {
        try {
          const cotHtml = await fetchHtml(`${BASE_URL}/marches/cotation_${sikaSym}`, {
            checkRobots: true,
            cacheTtlMs: 12 * 60 * 60 * 1000,
          });
          const cotIsin = cotHtml.match(/\b([A-Z]{2}\d{10})\b/);
          if (cotIsin) isin = cotIsin[1]!;
        } catch {
          /* ignore */
        }
      }

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
      // Format Sika : <span id="lstActionnaires">NOM*42,3;AUTRE*27,7</span>
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
          const perRow = [...byLabel.entries()].find(([l]) => l === "per" || l.startsWith("per"));
          const growthRow = [...byLabel.entries()].find(([l]) => l.includes("croissance ca"));
          const divRow = [...byLabel.entries()].find(([l]) => l.startsWith("dividende"));
          const rnRow = [...byLabel.entries()].find(([l]) => l.includes("résultat net") || l.includes("resultat net"));
          const caRow = [...byLabel.entries()].find(([l]) => l.includes("chiffre"));

          const per = perRow ? parseFrenchNumber(perRow[1][col] ?? "") : null;
          const revenueGrowth = growthRow ? parseFrenchNumber(growthRow[1][col] ?? "") : null;
          const divAmt = divRow ? parseFrenchNumber(divRow[1][col] ?? "") : null;

          // Marge nette approx si CA + RN présents (milliers / mêmes unités).
          let netMargin: number | null = null;
          const ca = caRow ? parseFrenchNumber(caRow[1][col] ?? "") : null;
          const rn = rnRow ? parseFrenchNumber(rnRow[1][col] ?? "") : null;
          if (ca != null && ca > 0 && rn != null) {
            netMargin = Math.round((rn / ca) * 10000) / 100;
          }

          if (per != null || revenueGrowth != null || netMargin != null || (year === new Date().getUTCFullYear() && mktCapMds != null)) {
            fundamentals.push({
              ticker: t,
              year,
              per,
              mktCapMds: year === new Date().getUTCFullYear() ? mktCapMds : null,
              closePrice: null,
              source: this.source,
              fetchedAt,
              revenueGrowth,
              netMargin,
            });
          }
          if (divAmt != null && divAmt > 0) {
            dividends.push({ ticker: t, year, amount: divAmt, source: this.source, fetchedAt });
          }
        }
      });

      // Cap actuelle seule si aucun tableau d'années mais valo présente.
      if (fundamentals.length === 0 && mktCapMds != null) {
        fundamentals.push({
          ticker: t,
          year: new Date().getUTCFullYear(),
          per: null,
          mktCapMds,
          closePrice: null,
          source: this.source,
          fetchedAt,
        });
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
        source: this.source,
        fetchedAt,
      };

      return { ok: true, source: this.source, data: { profile, fundamentals, dividends }, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }

  /**
   * Actualités liées à une valeur : `/marches/news_valeur?s={TICKER.cc}`.
   */
  async fetchCompanyNews(ticker: string): Promise<ConnectorResult<RawCompanyNewsItem[]>> {
    const fetchedAt = new Date().toISOString();
    const t = ticker.toUpperCase();
    try {
      const symbols = await loadSikaSymbolMap();
      const sikaSym = symbols.get(t);
      if (!sikaSym) {
        return {
          ok: false,
          source: this.source,
          error: `Ticker ${t} introuvable sur Sikafinance`,
          fetchedAt,
        };
      }
      const pageUrl = `${BASE_URL}/marches/news_valeur?s=${encodeURIComponent(sikaSym)}`;
      const html = await fetchHtml(pageUrl, { checkRobots: true, cacheTtlMs: 60 * 60 * 1000 });
      const $ = cheerio.load(html);
      const items: RawCompanyNewsItem[] = [];
      const seen = new Set<string>();

      $("a[href*='/marches/']").each((_, el) => {
        const href = ($(el).attr("href") ?? "").trim();
        if (!/\/marches\/.+\d+$/i.test(href)) return;
        if (/actualites_bourse|communiques_brvm/i.test(href)) return;
        const abs = href.startsWith("http")
          ? href
          : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
        if (seen.has(abs)) return;
        const title = $(el).text().replace(/\s+/g, " ").trim();
        if (title.length < 25) return;
        seen.add(abs);
        items.push({
          ticker: t,
          title,
          url: abs,
          summary: null,
          publishedAt: null,
          sourceName: "Sikafinance",
          fetchedAt,
        });
      });

      return { ok: true, source: this.source, data: items.slice(0, 40), fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }

  /**
   * Calendrier corporate : `/marches/events/{TICKER.cc}`.
   */
  async fetchCompanyEvents(ticker: string): Promise<ConnectorResult<RawCompanyEventItem[]>> {
    const fetchedAt = new Date().toISOString();
    const t = ticker.toUpperCase();
    try {
      const symbols = await loadSikaSymbolMap();
      const sikaSym = symbols.get(t);
      if (!sikaSym) {
        return {
          ok: false,
          source: this.source,
          error: `Ticker ${t} introuvable sur Sikafinance`,
          fetchedAt,
        };
      }
      const pageUrl = `${BASE_URL}/marches/events/${sikaSym}`;
      const html = await fetchHtml(pageUrl, { checkRobots: true, cacheTtlMs: 6 * 60 * 60 * 1000 });
      const $ = cheerio.load(html);
      const items: RawCompanyEventItem[] = [];

      $("table tr").each((_, tr) => {
        const cells = $(tr)
          .find("th,td")
          .toArray()
          .map((c) => $(c).text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim());
        if (cells.length === 0) return;
        const line = cells.join(" ").trim();
        if (!line || /^date\b/i.test(line)) return;

        const range = line.match(
          /^du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/i
        );
        if (range) {
          const start = parseSikaDate(range[1]!);
          const end = parseSikaDate(range[2]!);
          if (!start) return;
          const rest = range[3]!.trim();
          const [titlePart, ...commentParts] = rest.split(/(?=Montant\s*:)/i);
          items.push({
            ticker: t,
            title: (titlePart ?? rest).trim(),
            eventDate: start.iso,
            endDate: end?.iso ?? null,
            comment: commentParts.join(" ").trim() || null,
            sourceName: "Sikafinance",
            fetchedAt,
          });
          return;
        }

        const single = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
        if (single) {
          const start = parseSikaDate(single[1]!);
          if (!start) return;
          items.push({
            ticker: t,
            title: single[2]!.trim(),
            eventDate: start.iso,
            endDate: null,
            comment: null,
            sourceName: "Sikafinance",
            fetchedAt,
          });
        }
      });

      return { ok: true, source: this.source, data: items, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }

  /// Calendrier « Dividendes à venir » — dates de détachement (Sikafinance).
  /// https://www.sikafinance.com/marches/dividendes (#tbdDiv)
  async fetchUpcomingDividends(): Promise<ConnectorResult<RawDividendRow[]>> {
    const fetchedAt = new Date().toISOString();
    const url = `${BASE_URL}/marches/dividendes`;
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const rows: RawDividendRow[] = [];

      $("#tbdDiv tbody tr").each((_, tr) => {
        const dateRaw = $(tr).find("td").first().text().trim();
        if (/pr[eé]ciser/i.test(dateRaw)) return;
        const exDate = parseDdMmYyyy(dateRaw);
        const href = $(tr).find("a").attr("href") ?? "";
        const sym = href.match(/cotation_([A-Za-z0-9]+)\./i)?.[1];
        const ticker = sym?.toUpperCase() ?? "";
        const amount = parseFrenchNumber($(tr).find("td").eq(2).text());
        if (!ticker || !exDate || amount === null || !(amount > 0)) return;
        rows.push({
          ticker,
          year: 0,
          amount,
          source: this.source,
          fetchedAt,
          exDate,
          paymentDate: null,
        });
      });

      return { ok: true, source: this.source, data: rows, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: err instanceof HttpFetchError ? err.httpStatus : undefined,
        fetchedAt,
      };
    }
  }
}

export const sikafinanceConnector = new SikafinanceConnector();
export { DAILY_CHUNK_DAYS };