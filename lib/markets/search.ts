import { foldSearchText } from "@/lib/search/fold";
import { companyHref, normalizeExchange } from "@/lib/search/routes";

export interface ListingSearchItem {
  ticker: string;
  name: string;
  sector: string;
  /** Absent = BRVM (anciens appelants). Toute autre valeur est une place réelle. */
  exchange?: string;
}

export { companyHref };

/**
 * Limite par place. Les places viennent des lignes fournies : une place
 * supplémentaire en base apparaît sans modifier cette fonction.
 */
export function searchListings(items: ListingSearchItem[], query: string, exchange?: string, limit = 5) {
  const needle = foldSearchText(query);
  const wanted = exchange?.trim() ? normalizeExchange(exchange) : undefined;
  const markets = [...new Set(items.map((item) => normalizeExchange(item.exchange)))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const scoped = wanted ? markets.filter((market) => market === wanted) : markets;
  return scoped.map((market) => ({
    exchange: market,
    items: items
      .filter((item) => {
        if (normalizeExchange(item.exchange) !== market) return false;
        if (!needle) return true;
        return [item.ticker, item.name, item.sector].some((value) => foldSearchText(value).includes(needle));
      })
      .sort(
        (a, b) =>
          Number(foldSearchText(b.ticker) === needle) - Number(foldSearchText(a.ticker) === needle) ||
          a.name.localeCompare(b.name, "fr"),
      )
      .slice(0, limit),
  }));
}
