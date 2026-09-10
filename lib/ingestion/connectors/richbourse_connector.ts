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
import type { ConnectorResult, MarketDataConnector, RawDividendRow, RawIndexQuote, RawPriceQuote } from "../types";
import {
  parseRichbourseDividendCalendar,
  richbourseToRawRows,
} from "../richbourse-dividend-parser";

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
  const points = extractCloseSeriesFromHighcharts(html);
  if (points.length === 0) return null;
  return points[points.length - 1]!.value;
}

/// Tous les points `[timestamp, cours]` de la série de COURS (libellé
/// « (FCFA) »), triés chronologiquement. On évite volontairement un balayage
/// global du HTML : la même page embarque aussi volumes / flags dividende
/// (`[ts, volume]` → millions), qui fausseraient l'historique (ex. ETIT
/// « clôture 2025 = 102 648 » au lieu de ~21).
export function extractCloseSeriesFromHighcharts(html: string): Array<{ ts: number; value: number }> {
  const seriesChunk = extractFcfaSeriesDataChunk(html);
  const pointPattern = /\[(\d{10,13}),\s*([\d.]+)\]/g;
  const byTs = new Map<number, number>();
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(seriesChunk)) !== null) {
    const ts = Number(match[1]);
    const value = Number(match[2]);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) continue;
    // Garde-fou : aucun titre BRVM ne cote au-delà de ce plafond raisonnable.
    // Au-delà, ce sont presque toujours des volumes / artefacts Highcharts.
    if (value <= 0 || value > 200_000) continue;
    byTs.set(ts, value);
  }
  return [...byTs.entries()]
    .map(([ts, value]) => ({ ts, value }))
    .sort((a, b) => a.ts - b.ts);
}

/// Extrait le blob `data: [[ts,v],…]` de la série dont le nom contient
/// `(FCFA)`. Gère le ternaire Richbourse
/// `data: (ajustement === '…') ? [[…]] : [[…]]` en prenant la branche ELSE
/// (cours non ajustés fractionnement — plus proches du bulletin officiel).
function extractFcfaSeriesDataChunk(html: string): string {
  const nameIdx = html.search(/\(FCFA\)"\s*,/);
  if (nameIdx < 0) {
    // Repli historique (prototype étape 3) : dernier point global — moins sûr.
    return html;
  }
  const afterName = html.slice(nameIdx);
  const ternary = afterName.match(/data:\s*\([^)]*\)\s*\?([\s\S]*?):\s*(\[\[[\s\S]*?\]\])\s*,/);
  if (ternary?.[2]) return ternary[2];
  const plain = afterName.match(/data:\s*(\[\[[\s\S]*?\]\])\s*,/);
  return plain?.[1] ?? html;
}

/// Dernière clôture observée par année civile (UTC) dans la série Highcharts.
export function yearEndClosesFromHighcharts(html: string): Map<number, { date: string; closePrice: number }> {
  const byYear = new Map<number, { date: string; closePrice: number; ts: number }>();
  for (const { ts, value } of extractCloseSeriesFromHighcharts(html)) {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const prev = byYear.get(year);
    if (!prev || ts > prev.ts) {
      byYear.set(year, {
        ts,
        closePrice: value,
        date: d.toISOString().slice(0, 10),
      });
    }
  }
  const out = new Map<number, { date: string; closePrice: number }>();
  for (const [year, row] of byYear) out.set(year, { date: row.date, closePrice: row.closePrice });
  return out;
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

  /// Calendrier dividendes « année civile » — /common/dividende/index
  async fetchDividendCalendar(
    calendarYear = new Date().getUTCFullYear()
  ): Promise<ConnectorResult<RawDividendRow[]>> {
    const fetchedAt = new Date().toISOString();
    const url = `${BASE_URL}/common/dividende/index`;
    try {
      const html = await fetchHtml(url);
      const parsed = parseRichbourseDividendCalendar(html);
      const data = richbourseToRawRows(parsed, calendarYear, fetchedAt);
      if (data.length === 0) {
        return {
          ok: false,
          source: this.source,
          error: "Aucun dividende Richbourse — structure HTML probablement modifiée",
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

export const richbourseConnector = new RichbourseConnector();
