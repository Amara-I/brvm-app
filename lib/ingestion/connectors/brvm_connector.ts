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
import type { ConnectorResult, MarketDataConnector, RawIndexQuote, RawPriceQuote } from "../types";

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
          const closePrice = parseFrenchNumber($(cells[5]).text()); // "Cours Clôture (FCFA)"
          if (closePrice === null) return;
          results.push({
            ticker,
            closePrice,
            volume,
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
}

export const brvmConnector = new BrvmConnector();
