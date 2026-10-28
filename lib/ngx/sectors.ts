// Taxonomie sectorielle NGX propre à OuestBourse.
// Les secteurs NGX officiels (FINANCIAL SERVICES, OIL AND GAS…) sont regroupés en 13 familles
// lisibles. « FINANCIAL SERVICES » (43 lignes) mélange banques, assureurs et autres acteurs :
// on les sépare par ticker, car leurs ratios (PER, PBR, marges) ne se comparent pas entre eux.

export const NGX_SECTOR_GROUPS = [
  "BANKING",
  "INSURANCE",
  "CONSUMER_GOODS",
  "OIL_GAS",
  "INDUSTRIAL_GOODS",
  "ICT",
  "AGRICULTURE",
  "HEALTHCARE",
  "CONSTRUCTION_REAL_ESTATE",
  "SERVICES",
  "CONGLOMERATES",
  "NATURAL_RESOURCES",
  "OTHER",
] as const;

export type NgxSectorGroup = (typeof NGX_SECTOR_GROUPS)[number];

const BANK_TICKERS = new Set([
  "ABBEYBANK",
  "ACCESSCORP",
  "ETI",
  "FCMB",
  "FIDELITYBK",
  "FIRSTHOLDCO",
  "GTCO",
  "JAIZBANK",
  "LIVINGTRUST",
  "NPFMCRFBK",
  "STANBIC",
  "STERLINGNG",
  "UBA",
  "UNITYBNK",
  "WEMABANK",
  "ZENITHBANK",
]);

const INSURANCE_TICKERS = new Set([
  "AFRINSURE",
  "AIICO",
  "CONHALLPLC",
  "CORNERST",
  "CUSTODIAN",
  "FTGINSURE",
  "GUINEAINS",
  "INTENEGINS",
  "LASACO",
  "LINKASSURE",
  "MANSARD",
  "MBENEFIT",
  "NEM",
  "PRESTIGE",
  "REGALINS",
  "ROYALEX",
  "SOVRENINS",
  "SUNUASSUR",
  "UNIVINSURE",
  "VERITASKAP",
  "WAPIC",
]);

const BY_SECTOR_SLUG: Record<string, NgxSectorGroup> = {
  agriculture: "AGRICULTURE",
  conglomerates: "CONGLOMERATES",
  "construction-real-estate": "CONSTRUCTION_REAL_ESTATE",
  "consumer-goods": "CONSUMER_GOODS",
  healthcare: "HEALTHCARE",
  ict: "ICT",
  "industrial-goods": "INDUSTRIAL_GOODS",
  "natural-resources": "NATURAL_RESOURCES",
  "oil-and-gas": "OIL_GAS",
  services: "SERVICES",
  utilities: "OTHER",
  investment: "OTHER",
};

export function sectorSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Famille sectorielle propre d'un titre NGX. Secteur inconnu → OTHER. */
export function ngxSectorGroup(ticker: string, sectorSlugOrName: string): NgxSectorGroup {
  const t = ticker.trim().toUpperCase();
  if (BANK_TICKERS.has(t)) return "BANKING";
  if (INSURANCE_TICKERS.has(t)) return "INSURANCE";
  return BY_SECTOR_SLUG[sectorSlug(sectorSlugOrName)] ?? "OTHER";
}

/** Banques et assureurs : « résultat d'exploitation » et « chiffre d'affaires » ne signifient pas la même chose. */
export function isFinancialGroup(group: NgxSectorGroup): boolean {
  return group === "BANKING" || group === "INSURANCE";
}

/** Retire les suffixes techniques de la source NGX (« Security Name », marqueurs [MRF]/[BMF]…). */
export function cleanNgxName(name: string): string {
  return name
    .replace(/\s*\[[A-Z]{2,4}\]\s*/g, " ")
    .replace(/\s+Security Name\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
