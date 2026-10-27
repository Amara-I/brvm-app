// Périmètre de place. Les pages et jobs BRVM passent par ce filtre :
// une société NGX ne doit pas apparaître dans le screener, le méga-menu,
// le marché BRVM, l'export ou les sélecteurs de portefeuille.

export const LISTING_EXCHANGES = ["BRVM", "NGX"] as const;
export type ListingExchange = (typeof LISTING_EXCHANGES)[number];

export const DEFAULT_LISTING_EXCHANGE: ListingExchange = "BRVM";

export function isListingExchange(value: string | null | undefined): value is ListingExchange {
  return value === "BRVM" || value === "NGX";
}

/** Fragment Prisma `where`. Défaut BRVM. */
export function onExchange(exchange: ListingExchange = DEFAULT_LISTING_EXCHANGE): {
  exchange: ListingExchange;
} {
  return { exchange };
}

/** Clé métier (place, symbole). Le ticker seul reste unique tant qu'il n'y a pas de collision. */
export function listingKey(exchange: ListingExchange, ticker: string): string {
  return `${exchange}:${ticker.trim().toUpperCase()}`;
}

export function currencyForExchange(exchange: ListingExchange): "XOF" | "NGN" {
  return exchange === "NGX" ? "NGN" : "XOF";
}
