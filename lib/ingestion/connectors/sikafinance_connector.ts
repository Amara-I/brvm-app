// ═══════════════════════════════════════════════════════════════════════════
// Connecteur Sikafinance — SOURCE N°2 (source: "SIKAFINANCE")
// ═══════════════════════════════════════════════════════════════════════════
// Structure HTML vérifiée manuellement le 09/08/2026 :
//
//   - Page d'accueil (https://www.sikafinance.com/) : widget public avec la
//     valeur du BRVM Composite ET l'indice propriétaire "SIKA TOTAL RETURN",
//     dans des blocs `.mkcol` contenant `.mkname` (libellé + lien
//     `/marches/cotation_{SLUG}`), `.mkprice` (valeur) et `.mkvar`
//     (variation %). C'est la SEULE donnée de marché publique et non
//     paywall trouvée sur ce site à ce jour.
//
//   - ⚠️ Cotations par société : AUCUN endpoint public confirmé à ce jour.
//     `/marches/cotation_{TICKER}` (calqué sur le pattern des indices)
//     retourne 404 pour les tickers testés (ex: SNTS). Le robots.txt de
//     Sikafinance interdit explicitement `/listes/displaylist` et
//     `/portif/displayp`, qui étaient vraisemblablement les anciennes pages
//     de listing de cours — on les respecte et on ne les scrape PAS.
//     → `fetchQuotes()` ci-dessous tente `/marches/cotation_{TICKER}` par
//       ticker demandé (best effort, cache/rate-limit inclus) et ignore
//       silencieusement les 404. À COMPLÉTER dès qu'un endpoint public de
//       cotation par société est confirmé manuellement (cf. TODO).
//
// Ce connecteur reste isolé et désactivable indépendamment (cf. contrainte
// du brief) : si Sikafinance renforce son blocage anti-scraping, il suffit
// de faire retourner `ok:false` systématiquement sans toucher aux deux
// autres connecteurs ni à la logique de réconciliation.
// ═══════════════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { fetchHtml, HttpFetchError } from "../http-client";
import { parseFrenchNumber, toIsoDate, lastBusinessDay } from "../parse-utils";
import type { ConnectorResult, MarketDataConnector, RawIndexQuote, RawPriceQuote } from "../types";

const BASE_URL = "https://www.sikafinance.com";

/// Mapping slug Sikafinance → code d'indice normalisé commun à l'app.
/// "SIKATR" (Sika Total Return) est un indice PROPRIÉTAIRE à Sikafinance,
/// distinct du "BRVM – COMPOSITE TOTAL RETURN" officiel — on le garde sous
/// son propre code plutôt que de le confondre avec un indice BRVM.org.
const SLUG_TO_INDEX_CODE: Record<string, string> = {
  BRVMC: "BRVM_COMPOSITE",
  SIKATR: "SIKA_TOTAL_RETURN",
};

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
        if (!code) return; // indice non mappé → ignoré plutôt que mal classé

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
    const notes: string[] = [];

    for (const ticker of tickers) {
      const url = `${BASE_URL}/marches/cotation_${ticker.toUpperCase()}`;
      try {
        const html = await fetchHtml(url, { checkRobots: true });
        const $ = cheerio.load(html);
        const value = parseFrenchNumber($(".mkprice").first().text());
        if (value !== null) {
          results.push({ ticker: ticker.toUpperCase(), closePrice: value, volume: null, source: this.source, date: isoDate, fetchedAt });
        } else {
          notes.push(`${ticker}: page trouvée mais cours introuvable dans le HTML`);
        }
      } catch (err) {
        // 404 attendu tant que le vrai endpoint par société n'est pas
        // confirmé (cf. commentaire d'en-tête) — on log sans faire échouer
        // tout le connecteur pour les autres tickers.
        const status = err instanceof HttpFetchError ? err.httpStatus : undefined;
        notes.push(`${ticker}: indisponible sur Sikafinance (${status ?? "erreur"})`);
      }
    }

    // Le connecteur reste "ok" même à 0 résultat : l'absence de cotation
    // Sikafinance pour un ticker n'est pas une erreur bloquante, la
    // réconciliation (lib/ingestion/reconciliation.ts) sait fonctionner
    // avec des sources partiellement disponibles.
    return { ok: true, source: this.source, data: results, fetchedAt };
  }
}

export const sikafinanceConnector = new SikafinanceConnector();
