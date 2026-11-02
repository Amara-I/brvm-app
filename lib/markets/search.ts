import type { ListingExchange } from "./listing-scope";

export interface ListingSearchItem {
  ticker: string;
  name: string;
  sector: string;
  /** Absent uniquement pour les anciens appelants BRVM. */
  exchange?: ListingExchange;
}

export function companyHref(item: Pick<ListingSearchItem, "ticker" | "exchange">): string {
  const ticker = encodeURIComponent(item.ticker);
  return item.exchange === "NGX" ? `/marches/ngx/actions/${ticker}` : `/actions/${ticker}`;
}

/** Limite PAR marché : un univers plus grand ne masque pas l'autre. */
export function searchListings(items: ListingSearchItem[], query: string, exchange?: ListingExchange, limit = 5) {
  const needle = query.trim().toLocaleLowerCase("fr");
  return (["BRVM", "NGX"] as const).filter((market) => !exchange || exchange === market).map((market) => ({
    exchange: market,
    items: items.filter((item) => (item.exchange ?? "BRVM") === market &&
      (!needle || [item.ticker, item.name, item.sector].some((v) => v.toLocaleLowerCase("fr").includes(needle))))
      .sort((a, b) => Number(b.ticker.toLowerCase() === needle) - Number(a.ticker.toLowerCase() === needle) || a.name.localeCompare(b.name, "fr"))
      .slice(0, limit),
  }));
}
