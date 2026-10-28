// Anciens codes NGX → ticker courant en base.
//
// Les PDF « Daily Official List » portent le code en vigueur le jour de la
// séance. Quand une société change de code (holding, fusion, rebranding), les
// anciennes séances sont publiées sous l'ancien code, que le backfill écartait
// (il ne garde que les tickers présents en base). Résultat : l'historique d'un
// titre commençait à la date du changement de code.
//
// L'ISIN est celui du ticker courant dans le répertoire NGX (`InternationSecIN`,
// ex. NGWAPCO00002 pour HBMNG, ex-WAPCO) ; les dates de bascule viennent de
// séances échantillonnées dans les listes officielles.

export interface NgxTickerAlias {
  /** Code utilisé dans les anciens PDF. */
  old: string;
  /** Ticker courant en base. */
  current: string;
  isin: string;
  /** Dernière séance vue avec l'ancien code (information, non utilisée à l'exécution). */
  lastSeenOld?: string;
}

export const NGX_TICKER_ALIASES: readonly NgxTickerAlias[] = [
  { old: "FBNH", current: "FIRSTHOLDCO", isin: "NGFBNH000009", lastSeenOld: "2025-03-03" },
  { old: "ACCESS", current: "ACCESSCORP", isin: "NGACCESS0005", lastSeenOld: "2022-03-25" },
  { old: "STERLNBANK", current: "STERLINGNG", isin: "NGSTERLNHCO9", lastSeenOld: "2022-11-01" },
  { old: "WAPCO", current: "HBMNG", isin: "NGWAPCO00002", lastSeenOld: "2026-07-06" },
  { old: "CHIPLC", current: "CONHALLPLC", isin: "NGCONHALLPL3", lastSeenOld: "2023-11-01" },
  { old: "ABBEYBDS", current: "ABBEYBANK", isin: "NGABBEY00001", lastSeenOld: "2026-05-04" },
  { old: "DEAPCAP", current: "CMFC", isin: "NGDEAPCAP009", lastSeenOld: "2026-05-04" },
  { old: "UHOMREIT", current: "UHREIT", isin: "NGUHOMREIT06", lastSeenOld: "2026-08-03" },
] as const;

/**
 * Sociétés absentes de la Daily Official List mais présentes dans le Daily
 * Summary : le backfill n'allait chercher le Summary que si la liste
 * officielle manquait, donc ces titres n'avaient aucun cours historique.
 */
export const NGX_SUMMARY_ONLY: readonly { ticker: string; from: string }[] = [
  { ticker: "ZICHIS", from: "2026-01-20" },
] as const;

const BY_OLD = new Map(NGX_TICKER_ALIASES.map((alias) => [alias.old, alias.current]));

/** Ticker de base pour un code de PDF : lui-même s'il est connu, sinon son alias connu. */
export function resolveNgxTicker(symbol: string, known: ReadonlySet<string>): string | null {
  const sym = symbol.trim().toUpperCase();
  if (known.has(sym)) return sym;
  const current = BY_OLD.get(sym);
  return current && known.has(current) ? current : null;
}

export interface AliasQuoteLike {
  symbol: string;
}

/**
 * Réécrit les codes anciens vers le ticker courant et retire les lignes dont le
 * code n'est pas connu. Si une même séance porte l'ancien ET le nouveau code,
 * le code natif l'emporte (une seule ligne par ticker).
 */
export function applyNgxTickerAliases<T extends AliasQuoteLike>(
  quotes: readonly T[],
  known: ReadonlySet<string>
): { quotes: T[]; remapped: number; unknown: number } {
  const native = new Map<string, T>();
  const aliased = new Map<string, T>();
  let unknown = 0;
  let remapped = 0;
  for (const quote of quotes) {
    const sym = quote.symbol.trim().toUpperCase();
    const ticker = resolveNgxTicker(sym, known);
    if (!ticker) {
      unknown++;
      continue;
    }
    if (ticker === sym) {
      native.set(ticker, quote);
    } else if (!aliased.has(ticker)) {
      aliased.set(ticker, { ...quote, symbol: ticker });
    }
  }
  const out: T[] = [...native.values()];
  for (const [ticker, quote] of aliased) {
    if (native.has(ticker)) continue;
    out.push(quote);
    remapped++;
  }
  return { quotes: out, remapped, unknown };
}
