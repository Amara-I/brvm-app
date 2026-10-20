import { fold } from "./fold";

/**
 * Même clé pour les graphies SGI : apostrophe, trait d'union, « COTE D IVOIRE »
 * et « COTE DIVOIRE », « BURKINA FASO » et « BURKINA ».
 */
export function canonAlias(value: string): string {
  return fold(value)
    .replace(/\bcote d ivoire\b/g, "cote divoire")
    .replace(/\bburkina faso\b/g, "burkina")
    .replace(/\s+/g, " ")
    .trim();
}

const LISTING_TAILS: readonly { re: RegExp; forms: readonly string[] }[] = [
  { re: /^(.+?)\s+(?:ci|cote divoire|rci)$/, forms: ["ci", "cote divoire", "rci"] },
  { re: /^(.+?)\s+(?:bf|burkina)$/, forms: ["bf", "burkina"] },
  { re: /^(.+?)\s+(?:sn|senegal)$/, forms: ["sn", "senegal"] },
  { re: /^(.+?)\s+(?:bj|benin)$/, forms: ["bj", "benin"] },
  { re: /^(.+?)\s+(?:ne|niger)$/, forms: ["ne", "niger"] },
  { re: /^(.+?)\s+(?:ml|mali)$/, forms: ["ml", "mali"] },
  { re: /^(.+?)\s+(?:tg|togo)$/, forms: ["tg", "togo"] },
];

/**
 * Clés supplémentaires pour un nom de cotation : « Filtisac CI » couvre aussi
 * « FILTISAC COTE DIVOIRE ». Une clé trop courte ou ambiguë n'est pas émise.
 */
export function listingAliasKeys(name: string): string[] {
  const stripped = name.replace(/\([^)]*\)/g, " ");
  const base = canonAlias(stripped).replace(/\bex\b.*$/, "").replace(/\s+/g, " ").trim();
  if (base.length < 5) return [];
  const keys = new Set<string>();
  for (const rule of LISTING_TAILS) {
    const match = base.match(rule.re);
    const stem = match?.[1]?.trim() ?? "";
    if (stem.length < 2) continue;
    for (const form of rule.forms) {
      const key = `${stem} ${form}`.replace(/\s+/g, " ").trim();
      if (key.length >= 5) keys.add(key);
    }
  }
  return [...keys];
}

/**
 * Noms usuels vus sur les relevés SGI, absents ou abrégés dans `companies.name`.
 * Les clés sont repliées à l'initialisation. Un alias court (< 5 caractères)
 * ne compte que si le libellé entier est exactement cet alias.
 */
const RAW_ALIASES: Record<string, string> = {
  Sonatel: "SNTS",
  "Sonatel SN": "SNTS",
  "Sonatel Sénégal": "SNTS",
  "Orange CI": "ORAC",
  "Orange Côte d'Ivoire": "ORAC",
  "Orange Cote d'Ivoire": "ORAC",
  Onatel: "ONTBF",
  "Onatel BF": "ONTBF",
  "Onatel Burkina": "ONTBF",
  "Coris Bank": "CBIBF",
  "Coris Bank International": "CBIBF",
  "Coris Bank BF": "CBIBF",
  SGCI: "SGBC",
  SGBCI: "SGBC",
  "SGB CI": "SGBC",
  "Société Générale": "SGBC",
  "Société Générale CI": "SGBC",
  "Société Générale Côte d'Ivoire": "SGBC",
  "Société Générale de Banques en Côte d'Ivoire": "SGBC",
  "NSIA Banque": "NSBC",
  "NSIA Banque CI": "NSBC",
  NSIA: "NSBC",
  "Ecobank CI": "ECOC",
  "Ecobank Côte d'Ivoire": "ECOC",
  ETI: "ETIT",
  "Ecobank Transnational": "ETIT",
  "Ecobank Transnational Incorporated": "ETIT",
  SITAB: "STBC",
  "SITAB CI": "STBC",
  Solibra: "SLBC",
  "BOA Bénin": "BOAB",
  "BOA Benin": "BOAB",
  "Bank of Africa Bénin": "BOAB",
  "BOA Burkina": "BOABF",
  "BOA Burkina Faso": "BOABF",
  "BOA Niger": "BOAN",
  "BOA Sénégal": "BOAS",
  "BOA Senegal": "BOAS",
  "BOA CI": "BOAC",
  "BOA Côte d'Ivoire": "BOAC",
  "Bank of Africa Côte d'Ivoire": "BOAC",
  "BOA Mali": "BOAM",
  SODECI: "SDCC",
  "SODE CI": "SDCC",
  PALMCI: "PALC",
  "Palm CI": "PALC",
  "Total Sénégal": "TTLS",
  "Total Senegal": "TTLS",
  "Total SN": "TTLS",
  "TotalEnergies Sénégal": "TTLS",
  "TotalEnergies SN": "TTLS",
  "Total CI": "TTLC",
  "TotalEnergies CI": "TTLC",
  "TotalEnergies Marketing": "TTLC",
  "TotalEnergies Marketing CI": "TTLC",
  "Vivo Energy": "SHEC",
  "Vivo Energy CI": "SHEC",
  "Shell CI": "SHEC",
  Nestlé: "NTLC",
  "Nestle CI": "NTLC",
  Servair: "ABJC",
  "Servair Abidjan": "ABJC",
  "Bridge Bank": "BBGCI",
  "Bridge Bank Group": "BBGCI",
  BICICI: "BICC",
  "BICI CI": "BICC",
  Bernabé: "BNBC",
  Bernabe: "BNBC",
  Sicable: "CABC",
  CFAO: "CFAC",
  "CFAO Motors": "CFAC",
  "CFAO Motors CI": "CFAC",
  CIE: "CIEC",
  "Compagnie Ivoirienne d'Électricité": "CIEC",
  // Relevés SGI : « CIE COTE DIVOIRE », « CIE COTE D'IVOIRE », « CIE COTE D IVOIRE ».
  "CIE COTE DIVOIRE": "CIEC",
  Filtisac: "FTSC",
  "Filtisac CI": "FTSC",
  "FILTISAC COTE DIVOIRE": "FTSC",
  "Air Liquide": "SIVC",
  Erium: "SIVC",
  Unilever: "UNLC",
  "Unilever CI": "UNLC",
  Uniwax: "UNXC",
  SIB: "SIBC",
  "Société Ivoirienne de Banque": "SIBC",
  Sucrivoire: "SCRC",
  SOGB: "SOGC",
  SAPH: "SPHC",
  SETAO: "STAC",
  Sicor: "SICC",
  SMB: "SMBC",
  "SMB CI": "SMBC",
  BIIC: "BICB",
  "BIIC Bénin": "BICB",
  LONACI: "LNBB",
  "Loterie Nationale du Bénin": "LNBB",
  Oragroup: "ORGT",
  Tractafric: "PRSC",
  "Tractafric Motors": "PRSC",
  SAFCA: "SAFC",
  "Alios Finance": "SAFC",
  "Crown Siem": "SEMC",
  Eviosys: "SEMC",
  "NEI CEDA": "NEIC",
  "NEI-CEDA": "NEIC",
  "Africa Global Logistics": "SDSC",
  Bolloré: "SDSC",
  Bollore: "SDSC",
};

export const TICKER_ALIASES: ReadonlyMap<string, string> = new Map(
  Object.entries(RAW_ALIASES).map(([label, ticker]) => [canonAlias(label), ticker])
);

/** Alias dont la clé fait au moins 5 caractères, du plus long au plus court. */
export const TICKER_ALIAS_PHRASES: readonly { phrase: string; ticker: string }[] = [...TICKER_ALIASES.entries()]
  .filter(([phrase]) => phrase.length >= 5)
  .map(([phrase, ticker]) => ({ phrase, ticker }))
  .sort((a, b) => b.phrase.length - a.phrase.length);
