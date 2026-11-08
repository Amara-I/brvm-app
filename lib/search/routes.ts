/**
 * Routes par place.
 * BRVM garde ses URLs historiques (`/actions`, `/indices`, `/marche`).
 * Toute autre place — y compris une place ajoutée plus tard dans
 * `Company.exchange` — suit `/marches/{code}/…`. Aucune liste de places
 * n'est énumérée ici.
 */
const BRVM = "BRVM";

export function normalizeExchange(exchange: string | null | undefined): string {
  const code = (exchange ?? "").trim();
  return (code || BRVM).toUpperCase();
}

export function companyHref(item: { ticker: string; exchange?: string | null }): string {
  const ticker = encodeURIComponent(item.ticker.trim());
  const exchange = normalizeExchange(item.exchange);
  if (exchange === BRVM) return `/actions/${ticker}`;
  return `/marches/${encodeURIComponent(exchange.toLowerCase())}/actions/${ticker}`;
}

export function indexHref(item: { code: string; exchange?: string | null }): string {
  const code = encodeURIComponent(item.code.trim());
  const exchange = normalizeExchange(item.exchange);
  if (exchange === BRVM) return `/indices/${code}`;
  return `/marches/${encodeURIComponent(exchange.toLowerCase())}/indices/${code}`;
}

export function marketHomeHref(exchange: string): string {
  const code = normalizeExchange(exchange);
  if (code === BRVM) return "/marche";
  return `/marches/${encodeURIComponent(code.toLowerCase())}`;
}

export function marketIndicesListHref(exchange: string): string {
  const code = normalizeExchange(exchange);
  if (code === BRVM) return "/indices";
  return `/marches/${encodeURIComponent(code.toLowerCase())}/indices`;
}
