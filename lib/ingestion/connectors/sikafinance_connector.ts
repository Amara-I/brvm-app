// ═══════════════════════════════════════════════════════════════════════════
// Connecteur Sikafinance — SOURCE N°2 (source: "SIKAFINANCE")
// ═══════════════════════════════════════════════════════════════════════════
// Endpoints publics revalidés le 10/09/2026 :
//
//   - Cotations du jour : UNE page `/marches/aaz` (`#tblShare`) — Dernier,
//     volume, variation pour toutes les valeurs. L'ancien scrape
//     `/marches/cotation_{TICKER.cc}` via `.mkprice` est mort (la classe a
//     disparu ; `cotation_{TICKER}` sans suffixe pays reste en 404).
//   - Indices : `#tabQuotes2` sur la même page A–Z (BRVMC, BRVM30, SIKATR,
//     sectoriels) ; repli accueil `.mkcol` / `.mkprice`.
//   - Historique / dernier close de repli : POST `/api/general/GetHistos`
//     body `{ ticker:"SNTS.sn", datedeb, datefin, xperiod }`
//     xperiod "365" = annuel ; "30" = mensuel ; "0" = journalier
//     (journalier limité ~89 jours sinon erreur API `toolong` — chunker).
//   - Cotation HTML (profil/ISIN uniquement) : `/marches/cotation_{TICKER.cc}`
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
import { parseFrenchNumber, parseDdMmYyyy, toIsoDate, lastBusinessDay, shiftIsoDate } from "../parse-utils";
import {
  lastHistosQuote,
  mapSikaHistosToQuotes,
  parseSikaAazIndices,
  parseSikaAazQuotes,
  parseSikaDate,
  parseSikaHomepageIndices,
  parseSikaSymbolMap,
  toRawIndexQuotes,
  toRawPriceQuotes,
} from "../sika-market-parser";
import { parseSikaCompanySheetHtml } from "../sika-company-sheet-parser";
import type { IsoRange } from "../history-coverage";
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

interface SikaHistosResponse {
  lst?: unknown;
  error?: string;
}

let cachedSikaSymbols: Map<string, string> | null = null;

/// TTL court : la même URL sert aussi aux cours du jour (évite de resservir
/// un HTML A–Z de 24 h et d'afficher des clôtures périmées).
const AAZ_CACHE_TTL_MS = 5 * 60 * 1000;

/// Mappe TICKER → symbole Sikafinance `TICKER.cc` (ex. SNTS → SNTS.sn).
export async function loadSikaSymbolMap(): Promise<Map<string, string>> {
  if (cachedSikaSymbols) return cachedSikaSymbols;
  const html = await fetchHtml(AAZ_URL, { cacheTtlMs: AAZ_CACHE_TTL_MS });
  cachedSikaSymbols = parseSikaSymbolMap(html);
  return cachedSikaSymbols;
}

function rememberSymbolMap(html: string): Map<string, string> {
  cachedSikaSymbols = parseSikaSymbolMap(html);
  return cachedSikaSymbols;
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
      const aazHtml = await fetchHtml(AAZ_URL, { cacheTtlMs: AAZ_CACHE_TTL_MS });
      rememberSymbolMap(aazHtml);
      let parsed = parseSikaAazIndices(aazHtml);

      if (parsed.length === 0) {
        const homeHtml = await fetchHtml(BASE_URL);
        parsed = parseSikaHomepageIndices(homeHtml);
      }

      const results = toRawIndexQuotes(parsed, isoDate, fetchedAt);
      if (results.length === 0) {
        return {
          ok: false,
          source: this.source,
          error: "Aucun indice trouvé (A–Z / accueil) — structure HTML probablement modifiée",
          fetchedAt,
        };
      }
      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return { ok: false, source: this.source, error: err instanceof Error ? err.message : String(err), fetchedAt };
    }
  }

  async fetchQuotes(tickers: string[], date?: string): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fallbackDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();
    const wanted = new Set(tickers.map((t) => t.toUpperCase()));

    let aazQuotes: RawPriceQuote[] = [];
    let symbols: Map<string, string> | null = cachedSikaSymbols;

    try {
      const html = await fetchHtml(AAZ_URL, { cacheTtlMs: AAZ_CACHE_TTL_MS });
      symbols = rememberSymbolMap(html);
      const sessionDate = await this.resolveSessionDate(symbols, [...wanted], fallbackDate);
      aazQuotes = toRawPriceQuotes(parseSikaAazQuotes(html), sessionDate, fetchedAt).filter((q) =>
        wanted.has(q.ticker)
      );
    } catch (err) {
      console.warn(
        `[sikafinance] A–Z: ${err instanceof Error ? err.message : String(err)} — repli GetHistos`
      );
    }

    if (aazQuotes.length > 0) {
      return { ok: true, source: this.source, data: aazQuotes, fetchedAt };
    }

    // Repli : dernier close GetHistos (fenêtre courte, 1 POST / ticker).
    // Utilisé seulement si le tableau A–Z est vide / inaccessible.
    if (!symbols) {
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
    }

    const histosQuotes: RawPriceQuote[] = [];
    const fromIso = shiftIsoDate(fallbackDate, -14) ?? fallbackDate;
    for (const ticker of wanted) {
      if (!symbols.get(ticker)) continue;
      const part = await this.fetchHistos(ticker, fromIso, fallbackDate, "0");
      if (!part.ok) continue;
      const last = lastHistosQuote(part.data);
      if (last) histosQuotes.push(last);
    }

    if (histosQuotes.length === 0 && wanted.size > 0) {
      return {
        ok: false,
        source: this.source,
        error: "Aucun cours Sikafinance (A–Z vide et GetHistos sans donnée)",
        fetchedAt,
      };
    }
    return { ok: true, source: this.source, data: histosQuotes, fetchedAt };
  }

  /// Date de séance la plus récente via un unique GetHistos (évite de dater
  /// les cours A–Z au `lastBusinessDay` un lundi matin encore sans séance).
  private async resolveSessionDate(
    symbols: Map<string, string>,
    preferredTickers: string[],
    fallbackIso: string
  ): Promise<string> {
    const probe = ["SNTS", "SGBC", ...preferredTickers].find((t) => symbols.has(t));
    if (!probe) return fallbackIso;
    const fromIso = shiftIsoDate(fallbackIso, -14) ?? fallbackIso;
    const part = await this.fetchHistos(probe, fromIso, fallbackIso, "0");
    if (!part.ok) return fallbackIso;
    const last = lastHistosQuote(part.data);
    if (!last || last.date > fallbackIso) return fallbackIso;
    return last.date;
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
        if (!pt || typeof pt !== "object") continue;
        const row = pt as { Date?: string; Close?: number; Volume?: number };
        if (typeof row.Close !== "number" || row.Close <= 0 || typeof row.Date !== "string") continue;
        const storageDate = annualPointStorageDate(row.Date);
        if (!storageDate || storageDate > toDate) continue;
        results.push({
          ticker: t,
          closePrice: row.Close,
          volume: typeof row.Volume === "number" && row.Volume > 0 ? row.Volume : null,
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

      const results = mapSikaHistosToQuotes(t, json.lst, { dateMax: datefin, fetchedAt });
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
   * Journalier uniquement sur les fenêtres encore lacunaires (évite de
   * re-pager 20 ans déjà densifiés). Chaque fenêtre doit rester ≤ 89 j.
   */
  async fetchDailyHistoryGaps(
    ticker: string,
    ranges: IsoRange[]
  ): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fetchedAt = new Date().toISOString();
    if (ranges.length === 0) {
      return { ok: true, source: this.source, data: [], fetchedAt };
    }
    const all: RawPriceQuote[] = [];
    for (const range of ranges) {
      const part = await this.fetchHistos(ticker, range.from, range.to, "0");
      if (!part.ok) {
        if (!part.error.includes("toolong") && !part.error.includes("introuvable")) {
          console.warn(`[sikafinance] daily ${ticker} ${range.from}→${range.to}: ${part.error}`);
        }
        continue;
      }
      all.push(...part.data);
    }
    const byDate = new Map<string, RawPriceQuote>();
    for (const q of all) byDate.set(q.date, q);
    return {
      ok: true,
      source: this.source,
      data: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      fetchedAt,
    };
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
      const parsed = parseSikaCompanySheetHtml(html, t, fetchedAt);

      if (!parsed.profile.isin) {
        try {
          const cotHtml = await fetchHtml(`${BASE_URL}/marches/cotation_${sikaSym}`, {
            checkRobots: true,
            cacheTtlMs: 12 * 60 * 60 * 1000,
          });
          const cotIsin = cotHtml.match(/\b([A-Z]{2}\d{10})\b/);
          if (cotIsin) parsed.profile.isin = cotIsin[1]!;
        } catch {
          /* ignore */
        }
      }

      return { ok: true, source: this.source, data: parsed, fetchedAt };
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