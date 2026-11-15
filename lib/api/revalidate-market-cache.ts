import { revalidateTag } from "next/cache";

/** Invalide le cache Next.js du jeu de données marché (cours, signaux, conseils). */
export function revalidateMarketDataCache(): void {
  revalidateTag("companies-full");
  // Fiches d'indice : niveaux et variations du jour des composantes.
  revalidateTag("market-indices");
}

/** Invalide le cache du calendrier dividendes. */
export function revalidateDividendCalendarCache(): void {
  revalidateTag("dividend-calendar");
}
