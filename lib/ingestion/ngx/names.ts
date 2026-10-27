/** Libellés NGX officiels (anglais). L'affichage FR/EN passe par i18n, pas par ce slug. */
export const NGX_SECTORS = [
  "AGRICULTURE",
  "CONGLOMERATES",
  "CONSTRUCTION/REAL ESTATE",
  "CONSUMER GOODS",
  "FINANCIAL SERVICES",
  "HEALTHCARE",
  "ICT",
  "INDUSTRIAL GOODS",
  "INVESTMENT",
  "NATURAL RESOURCES",
  "OIL AND GAS",
  "SERVICES",
  "UTILITIES",
] as const;

const CHART_COLORS = [
  "#1F6F8B",
  "#C44900",
  "#2E7D32",
  "#6A1B9A",
  "#AD1457",
  "#1565C0",
  "#00838F",
  "#EF6C00",
  "#4527A0",
  "#00695C",
  "#5D4037",
  "#37474F",
  "#7B1FA2",
  "#0277BD",
  "#558B2F",
  "#D84315",
];

export function sectorSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeLegalName(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(PLC|LIMITED|LTD)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ne remplace pas une raison sociale déjà enregistrée par le libellé court
 * du JSON (`Company2`), sauf si le nom en base n'est encore que le ticker.
 * Un nom plus long (liste officielle) peut remplacer un libellé court.
 */
export function chooseCompanyName(current: string | null | undefined, incoming: string, ticker: string): string {
  const next = incoming.trim();
  const prev = current?.trim() ?? "";
  const symbol = ticker.trim().toUpperCase();
  if (!next) return prev || symbol;
  if (!prev || prev.toUpperCase() === symbol) return next;
  if (next.toUpperCase() === symbol) return prev;
  if (next.length > prev.length + 3) return next;
  return prev;
}

/** Couleur de courbe, distincte de la palette du site. */
export function colorForTicker(ticker: string): string {
  let hash = 0;
  for (const char of ticker.toUpperCase()) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return CHART_COLORS[hash % CHART_COLORS.length]!;
}
