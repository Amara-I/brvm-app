// Taxonomie sectorielle NGX propre à OuestBourse.
// Les secteurs NGX officiels (FINANCIAL SERVICES, OIL AND GAS…) sont regroupés en familles
// lisibles. « FINANCIAL SERVICES » mélange banques, assureurs et autres acteurs :
// on les sépare par ticker, car leurs ratios (PER, PBR, marges) ne se comparent pas entre eux.
// INFINITY (banque hypothécaire) est classé avec les banques. Les services publics et le
// reliquat financier (UCAP, NGXGROUP, etc.) ont leur propre famille, plus « Autres ».

export const NGX_SECTOR_GROUPS = [
  "BANKING",
  "INSURANCE",
  "FINANCIAL_SERVICES",
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
  "UTILITIES",
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
  "INFINITY",
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
  "financial-services": "FINANCIAL_SERVICES",
  healthcare: "HEALTHCARE",
  ict: "ICT",
  "industrial-goods": "INDUSTRIAL_GOODS",
  investment: "FINANCIAL_SERVICES",
  "natural-resources": "NATURAL_RESOURCES",
  "oil-and-gas": "OIL_GAS",
  services: "SERVICES",
  utilities: "UTILITIES",
};

export function sectorSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SnakeToKebab<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Lowercase<Head>}-${SnakeToKebab<Tail>}`
  : Lowercase<S>;

/** Identifiant d'URL / d'ancre d'une famille (banking, financial-services, oil-gas…). */
export type NgxSectorGroupSlug = SnakeToKebab<NgxSectorGroup>;

export function ngxSectorGroupSlug(group: NgxSectorGroup): NgxSectorGroupSlug {
  return group.toLowerCase().replace(/_/g, "-") as NgxSectorGroupSlug;
}

/** Interprète ?secteur=banking (tirets ou underscores, casse indifférente). */
export function parseNgxSectorGroupSlug(value: string | null | undefined): NgxSectorGroup | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  return NGX_SECTOR_GROUPS.find((group) => ngxSectorGroupSlug(group) === normalized) ?? null;
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
