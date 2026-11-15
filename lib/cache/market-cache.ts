// Cache serveur partagé (Next.js data cache) pour les chargements marché lourds.
// Une invalidation par étiquette suit chaque ingestion des cours, si bien que
// le cache ne masque jamais longtemps une séance fraîchement importée.

import { revalidateTag, unstable_cache } from "next/cache";

/** Étiquette des données de la vue d'ensemble / du screener NGX. */
export const NGX_MARKET_TAG = "ngx-market";
/** Durée de vie (s) avant relecture en arrière-plan. */
export const NGX_MARKET_REVALIDATE_S = 600;

function isMissingNextCache(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /incrementalCache missing|static generation store missing/i.test(message);
}

/**
 * `unstable_cache` avec repli transparent hors runtime Next.js (scripts tsx,
 * vitest) : la fonction est alors simplement appelée sans cache.
 */
export function cachedLoader<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] }
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, keyParts, options);
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (err) {
      if (isMissingNextCache(err)) return fn(...args);
      throw err;
    }
  };
}

/** Invalide le cache NGX (après ingestion des cours). Sans effet hors runtime Next.js. */
export function revalidateNgxMarketCache(): void {
  try {
    revalidateTag(NGX_MARKET_TAG);
  } catch (err) {
    if (!isMissingNextCache(err)) throw err;
  }
}

/** Étiquette des fiches d'indice (séries, variations du jour des composantes). */
export const MARKET_INDICES_TAG = "market-indices";
/** 1 h : les niveaux d'indice ne changent qu'une fois par séance. */
export const MARKET_INDICES_REVALIDATE_S = 3600;

/** Invalide le cache des fiches d'indice (après ingestion). Sans effet hors runtime Next.js. */
export function revalidateMarketIndicesCache(): void {
  try {
    revalidateTag(MARKET_INDICES_TAG);
  } catch (err) {
    if (!isMissingNextCache(err)) throw err;
  }
}
