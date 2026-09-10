/** Libellés « Emetteur » BRVM.org → tickers internes (47 sociétés cotées). */

export function normalizeIssuerLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Alias explicites (libellé BRVM ≠ nom seed). */
const BRVM_ISSUER_ALIASES: Record<string, string> = {
  "NEI CEDA CI": "NEIC",
  "SGCI": "SGBC",
  "SOCIETE GENERALE CI": "SGBC",
  "NSIA BANQUE CI": "NSBC",
  "NESTLE CI": "NTLC",
  TOTAL: "TTLC",
  "TOTALENERGIES MARKETING CI": "TTLC",
  "SAPH CI": "SPHC",
  SOGB: "SOGC",
  "SOGB CI": "SOGC",
  SITAB: "STBC",
  "SITAB CI": "STBC",
  "CFAO MOTORS CI": "CFAC",
  "VIVO ENERGY CI": "SHEC",
  "SERVAIR ABIDJAN": "ABJC",
  "SERVAIR ABIDJAN CI": "ABJC",
  LNB: "LNBB",
  "LOTERIE NATIONALE DU BENIN": "LNBB",
  "LOTERIE NAT BENIN": "LNBB",
  "ECOBANK CI": "ECOC",
  "BICI CI": "BICC",
  "BRIDGE BANK GROUP CI": "BBGCI",
  "CROWN SIEM CI": "SEMC",
  "EVIOSYS PACKAGING CI": "SEMC",
};

export function buildBrvmIssuerResolver(
  companies: Array<{ ticker: string; name: string }>
): (issuerLabel: string) => string | null {
  const map = new Map<string, string>();

  for (const [alias, ticker] of Object.entries(BRVM_ISSUER_ALIASES)) {
    map.set(normalizeIssuerLabel(alias), ticker);
  }
  for (const co of companies) {
    map.set(normalizeIssuerLabel(co.ticker), co.ticker);
    map.set(normalizeIssuerLabel(co.name), co.ticker);
  }

  return (issuerLabel: string) => map.get(normalizeIssuerLabel(issuerLabel)) ?? null;
}
