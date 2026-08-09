// ═══════════════════════════════════════════════════════════════════════════
// Connecteur Richbourse — SOURCE N°3 (source: "RICHBOURSE")
// ═══════════════════════════════════════════════════════════════════════════
// Structure HTML vérifiée manuellement le 09/08/2026 :
//
//   - Indices : https://www.richbourse.com/common/variation/indice/veille/tout
//     (chemin autorisé par robots.txt — non listé dans les `Disallow`) →
//     un unique `<table id="parcours_variation_indice_table">` listant TOUS
//     les indices (principaux + sectoriels), colonnes : icône | Symbole
//     (libellé + lien `/common/mouvements/indice/{CODE}`) | Variation (%) |
//     Fermeture de la veille | Fermeture actuelle | lien historique.
//     ⚠️ Richbourse utilise le POINT comme séparateur décimal (ex: "231.22",
//     "0.79%"), contrairement à BRVM.org/Sikafinance qui utilisent la
//     virgule — `parseFrenchNumber` gère les deux formats sans ambiguïté.
//
//   - Cours par société : https://www.richbourse.com/common/mouvements/index/{TICKER}
//     Page publique (chemin `/common/` non gated) affichant un graphique
//     Highcharts dont la série de cours de clôture est injectée côté serveur
//     dans le HTML (`data: [[timestamp, cours], ...]`). On extrait le
//     dernier point de cette série pour obtenir le cours le plus récent.
//     ⚠️ Extraction par regex sur un blob JS embarqué = fragile par nature
//     (le format peut changer sans préavis si Richbourse modifie son
//     intégration Highcharts). C'est acceptable pour ce PROTOTYPE ; à durcir
//     (ex: endpoint JSON dédié si Richbourse en expose un) avant
//     industrialisation (étape 6).
//   - Les fiches "analyse société" détaillées (PER, ROE...) sont, elles,
//     verrouillées derrière un mur Premium pour les visiteurs anonymes
//     (`/investisseur/analyse-societe/...`) — non exploitées ici.
// ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { fetchHtml } from "../http-client";
import { parseFrenchNumber, toIsoDate, lastBusinessDay } from "../parse-utils";
import type { ConnectorResult, MarketDataConnector, RawIndexQuote, RawPriceQuote } from "../types";

const BASE_URL = "https://www.richbourse.com";

function normalizeIndexCode(hrefOrLabel: string): string {
  return hrefOrLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/// Extrait le dernier point `[timestamp, valeur]` d'une série Highcharts à
/// 2 valeurs (cours de clôture) embarquée dans la page. Les séries OHLC
/// (4 valeurs par point) ne matchent volontairement pas ce pattern, ce qui
/// évite de les confondre avec la série "cours simple".
function extractLatestClosePriceFromHighcharts(html: string): number | null {
  const pointPattern = /\[(\d{10,13}),\s*([\d.]+)\]/g;
  let latestTimestamp = -Infinity;
  let latestValue: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(html)) !== null) {
    const ts = Number(match[1]);
    const value = Number(match[2]);
    if (ts > latestTimestamp) {
      latestTimestamp = ts;
      latestValue = value;
    }
  }
  return latestValue;
}

export class RichbourseConnector implements MarketDataConnector {
  readonly source = "RICHBOURSE" as const;

  async fetchIndices(date?: string): Promise<ConnectorResult<RawIndexQuote[]>> {
    const isoDate = date ?? toIsoDate(lastBusinessDay());
    const fetchedAt = new Date().toISOString();
    const url = `${BASE_URL}/common/variation/indice/veille/tout`;

    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results: RawIndexQuote[] = [];

      $("#parcours_variation_indice_table tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        const link = $(cells[1]).find("a");
        const href = link.attr("href") ?? "";
        const codeSlug = href.split("/").pop() ?? "";
        const label = link.text().trim();
        const changePercent = parseFrenchNumber($(cells[2]).text());
        const value = parseFrenchNumber($(cells[4]).text()); // "Fermeture actuelle"
        if (!label || value === null) return;

        results.push({
          code: normalizeIndexCode(codeSlug || label),
          label,
          value,
          changePercent,
          source: this.source,
          date: isoDate,
          fetchedAt,
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
    const results: RawPriceQuote[] = [];

    for (const ticker of tickers) {
      const url = `${BASE_URL}/common/mouvements/index/${ticker.toUpperCase()}`;
      try {
        const html = await fetchHtml(url);
        const closePrice = extractLatestClosePriceFromHighcharts(html);
        if (closePrice !== null) {
          results.push({ ticker: ticker.toUpperCase(), closePrice, volume: null, source: this.source, date: isoDate, fetchedAt });
        }
      } catch {
        // Ticker inconnu de Richbourse (404) ou page temporairement
        // indisponible → ignoré pour ce ticker, sans faire échouer les autres.
      }
    }

    return { ok: true, source: this.source, data: results, fetchedAt };
  }
}

export const richbourseConnector = new RichbourseConnector();
