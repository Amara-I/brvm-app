// ═══════════════════════════════════════════════════════════════════════════
// Connecteur BRVM.org — SOURCE DE VÉRITÉ N°1 (source: "BRVM_OFFICIEL")
// ═══════════════════════════════════════════════════════════════════════════
// Structure HTML vérifiée manuellement le 09/08/2026 sur les pages publiques
// suivantes (aucune authentification requise, robots.txt de brvm.org les
// autorise, Crawl-delay: 10s honoré par lib/ingestion/http-client.ts) :
//
//   - Indices du jour : https://www.brvm.org/fr/indices/0/{YYYY-MM-DD}
//     → 3 blocs `<section id="block-tools-indices">`, chacun avec un
//       `<h2 class="block-title">` ("" pour les indices principaux,
//       "Indices sectoriels", "Indice Total Return") suivi d'un `<table>`
//       de colonnes : Nom | Fermeture précédente | Fermeture | Variation (%)
//       | Variation 31 décembre (%).
//
//   - Cours du jour : https://www.brvm.org/fr/cours-actions/0/0/{YYYY-MM-DD}
//     → dernier `<table>` de la page, colonnes : Symbole | Nom | Volume |
//       Cours veille (FCFA) | Cours Ouverture (FCFA) | Cours Clôture (FCFA)
//       | Variation (%).
//
// ⚠️ Si BRVM.org change son thème (le site est un Drupal 7 classique), ce
// connecteur doit être mis à jour en isolation — c'est justement pour cela
// qu'il vit dans son propre fichier, indépendant des deux autres connecteurs.
// ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { fetchHtml } from "../http-client";
import { parseFrenchNumber, toIsoDate, lastBusinessDay } from "../parse-utils";
import { mergeBrvmDividendRows, parseBrvmDividendPage } from "../brvm-dividend-parser";
import type {
  ConnectorResult,
  MarketDataConnector,
  RawCompanyFundamentals,
  RawDividendRow,
  RawIndexQuote,
  RawPriceQuote,
} from "../types";

const BASE_URL = "https://www.brvm.org";

/// Normalise le libellé BRVM.org (ex: "BRVM - COMPOSITE", "BRVM-30") vers un
/// code stable utilisé dans toute l'application (`MarketIndex.code`).
function normalizeIndexCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class BrvmConnector implements MarketDataConnector {
  readonly source = "BRVM_OFFICIEL" as const;

  async fetchIndices(date?: string): Promise<ConnectorResult<RawIndexQuote[]>> {
    const isoDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();
    const url = `${BASE_URL}/fr/indices/0/${isoDate}`;

    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results: RawIndexQuote[] = [];

      $("section[id='block-tools-indices']").each((_, section) => {
        $(section)
          .find("table tbody tr")
          .each((__, row) => {
            const cells = $(row).find("td");
            const label = $(cells[0]).text().trim();
            const value = parseFrenchNumber($(cells[2]).text()); // "Fermeture"
            const changePercent = parseFrenchNumber($(cells[3]).text());
            if (!label || value === null) return;
            results.push({
              code: normalizeIndexCode(label),
              label,
              value,
              changePercent,
              source: this.source,
              date: isoDate,
              fetchedAt,
            });
          });
      });

      if (results.length === 0) {
        return { ok: false, source: this.source, error: "Aucun indice trouvé — structure HTML probablement modifiée", fetchedAt };
      }
      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return { ok: false, source: this.source, error: err instanceof Error ? err.message : String(err), fetchedAt };
    }
  }

  async fetchQuotes(tickers: string[], date?: string): Promise<ConnectorResult<RawPriceQuote[]>> {
    const isoDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();
    const url = `${BASE_URL}/fr/cours-actions/0/0/${isoDate}`;
    const wanted = new Set(tickers.map((t) => t.toUpperCase()));

    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // La page contient plusieurs <table> (top 5, flop 5, activité du
      // marché...) : on cible celle dont l'en-tête commence par "Symbole".
      const quotesTable = $("table").filter((_, table) => {
        const firstHeader = $(table).find("thead th").first().text().trim();
        return firstHeader === "Symbole";
      });

      const results: RawPriceQuote[] = [];
      quotesTable
        .find("tbody tr")
        .each((_, row) => {
          const cells = $(row).find("td");
          const ticker = $(cells[0]).text().trim().toUpperCase();
          if (!wanted.has(ticker)) return;
          const volume = parseFrenchNumber($(cells[2]).text());
          const prevClose = parseFrenchNumber($(cells[3]).text()); // "Cours veille (FCFA)"
          const closePrice = parseFrenchNumber($(cells[5]).text()); // "Cours Clôture (FCFA)"
          const changePercent = parseFrenchNumber($(cells[6]).text()); // "Variation (%)"
          if (closePrice === null) return;
          results.push({
            ticker,
            closePrice,
            volume,
            prevClose,
            changePercent,
            source: this.source,
            date: isoDate,
            fetchedAt,
          });
        });

      return { ok: true, source: this.source, data: results, fetchedAt };
    } catch (err) {
      return { ok: false, source: this.source, error: err instanceof Error ? err.message : String(err), fetchedAt };
    }
  }

  /// Fiche société publique `https://www.brvm.org/fr/{ticker}` : PER et
  /// capitalisation globale (absents de la page « cours-actions »). Un ticker
  /// introuvable est simplement omis — jamais d'échec global.
  async fetchFundamentals(tickers: string[], year?: number): Promise<ConnectorResult<RawCompanyFundamentals[]>> {
    const fetchedAt = new Date().toISOString();
    const targetYear = year ?? new Date().getUTCFullYear();
    const results: RawCompanyFundamentals[] = [];

    for (const rawTicker of tickers) {
      const ticker = rawTicker.toUpperCase();
      const url = `${BASE_URL}/fr/${ticker.toLowerCase()}`;
      try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        // Fiches Drupal BRVM : paires `.field-label` / `.field-item` (vérifié
        // le 10/08/2026 sur /fr/etit). Attention : deux libellés proches
        // coexistent — « Pourcentage capitalisation globale » (ex. 6.41) et
        // « Capitalisation globale » (ex. 1 211 635 150 374) — on exige le
        // libellé exact pour la cap. absolue.
        const fields = new Map<string, string>();
        $(".field-label").each((_, el) => {
          const label = $(el)
            .text()
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .replace(/:\s*$/, "")
            .trim()
            .toLowerCase();
          // Drupal : label puis sibling `.field-items > .field-item`.
          const resolved = $(el)
            .nextAll(".field-items")
            .first()
            .find(".field-item")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          if (label && resolved) fields.set(label, resolved);
        });

        const perRaw = parseFrenchNumber(fields.get("per") ?? "");
        const per = perRaw != null && perRaw > 0 ? perRaw : null;
        const closePrice = parseFrenchNumber(fields.get("cours clôture") ?? fields.get("cours cloture") ?? "");
        const mktCapFcfa = parseFrenchNumber(fields.get("capitalisation globale") ?? "");
        // Cap. < 1 Md FCFA = probablement le % mal lu → on ignore.
        const mktCapMds =
          mktCapFcfa !== null && mktCapFcfa >= 1_000_000_000 ? Math.round(mktCapFcfa / 1_000_000_000) : null;

        if (per === null && mktCapMds === null && closePrice === null) continue;
        results.push({
          ticker,
          year: targetYear,
          per,
          mktCapMds,
          closePrice,
          source: this.source,
          fetchedAt,
        });
      } catch {
        // Fiche absente / erreur réseau pour CE ticker → on continue.
      }
    }

    return { ok: true, source: this.source, data: results, fetchedAt };
  }

  /// Calendrier officiel des dividendes — toutes les pages paginées.
  /// https://www.brvm.org/fr/esv/paiement-de-dividendes
  async fetchDividendCalendar(
    resolveTicker: (issuerLabel: string) => string | null
  ): Promise<ConnectorResult<RawDividendRow[]>> {
    const fetchedAt = new Date().toISOString();
    const collected: RawDividendRow[] = [];

    try {
      for (let page = 0; page < 50; page++) {
        const url =
          page === 0
            ? `${BASE_URL}/fr/esv/paiement-de-dividendes`
            : `${BASE_URL}/fr/esv/paiement-de-dividendes?page=${page}`;
        const html = await fetchHtml(url);
        const pageRows = parseBrvmDividendPage(html, fetchedAt, resolveTicker);
        if (pageRows.length === 0) break;
        collected.push(...pageRows);
      }

      const data = mergeBrvmDividendRows(collected);
      if (data.length === 0) {
        return {
          ok: false,
          source: this.source,
          error: "Aucun dividende trouvé — structure HTML probablement modifiée",
          fetchedAt,
        };
      }
      return { ok: true, source: this.source, data, fetchedAt };
    } catch (err) {
      return {
        ok: false,
        source: this.source,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt,
      };
    }
  }
}

export const brvmConnector = new BrvmConnector();
