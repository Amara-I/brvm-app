// Métadonnées structurelles des indices (famille, composition) — pas de chiffres.
// Les niveaux / variations viennent exclusivement de `market_indices` en base.

export const HEADLINE_INDEX_CODES = ["BRVM_COMPOSITE", "BRVM_30"] as const;

export type IndexFamily = "principal" | "sectoriel" | "autre";
export type IndexCompositionKind = "all_listed" | "sector_peers" | "unavailable";

export interface IndexCatalogEntry {
  family: IndexFamily;
  compositionKind: IndexCompositionKind;
  /** Secteur interne (Company.sector.name) si compositionKind === sector_peers. */
  sectorName?: string;
  description: string;
}

const KNOWN: Record<string, IndexCatalogEntry> = {
  BRVM_COMPOSITE: {
    family: "principal",
    compositionKind: "all_listed",
    description:
      "Indice de l’ensemble des valeurs cotées à la BRVM. Les pondérations officielles ne sont pas stockées en base.",
  },
  BRVM_30: {
    family: "principal",
    compositionKind: "unavailable",
    description:
      "Indice des 30 valeurs les plus liquides de la BRVM. La composition officielle n’est pas encore disponible en base.",
  },
  BRVM_PRESTIGE: {
    family: "principal",
    compositionKind: "unavailable",
    description: "Compartiment Prestige de la BRVM. Composition officielle N/D en base.",
  },
  BRVM_PRINCIPAL: {
    family: "principal",
    compositionKind: "unavailable",
    description: "Compartiment Principal de la BRVM. Composition officielle N/D en base.",
  },
  BRVM_COMPOSITE_TOTAL_RETURN: {
    family: "principal",
    compositionKind: "all_listed",
    description:
      "Indice total return du Composite BRVM. Les pondérations officielles ne sont pas stockées en base.",
  },
  SIKA_TOTAL_RETURN: {
    family: "autre",
    compositionKind: "unavailable",
    description:
      "Indice total return publié par Sikafinance — ce n’est pas un indice officiel BRVM. Composition N/D.",
  },
  INDICE_SIKAFINANCE: {
    family: "autre",
    compositionKind: "unavailable",
    description: "Indicateur Sikafinance — ce n’est pas un indice officiel BRVM. Composition N/D.",
  },
};

const SECTOR_ALIASES: Array<{ pattern: RegExp; sectorName: string }> = [
  { pattern: /BRVM.*SERVICES[_\s-]?PUBLICS|\bBRVM[_-]?SP\b/, sectorName: "Services Publics" },
  { pattern: /BRVM.*INDUSTR/, sectorName: "Industrie" },
  { pattern: /BRVM.*(?:FINANCE|BANQUE)/, sectorName: "Banques" },
  { pattern: /BRVM.*TELECOM/, sectorName: "Télécoms" },
  { pattern: /BRVM.*ENERG/, sectorName: "Énergie" },
  {
    pattern: /BRVM.*CONSOMMATION[_\s-]*(DE[_\s-]*)?BASE|BRVM.*CONSO[_\s-]?BASE/,
    sectorName: "Conso. Base",
  },
  { pattern: /BRVM.*DISCRETIONNAIRE|BRVM.*CONSO[_\s-]?DISC/, sectorName: "Conso. Discrétionnaire" },
  { pattern: /BRVM.*DIVERT/, sectorName: "Divertissement" },
];

export const INDEX_FAMILY_LABELS: Record<IndexFamily, string> = {
  principal: "Principaux",
  sectoriel: "Sectoriels",
  autre: "Autres",
};

export function resolveIndexCatalog(code: string, name = ""): IndexCatalogEntry {
  const known = KNOWN[code.toUpperCase()];
  if (known) return known;

  const hay = `${code} ${name}`.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const alias of SECTOR_ALIASES) {
    if (alias.pattern.test(hay)) {
      return {
        family: "sectoriel",
        compositionKind: "sector_peers",
        sectorName: alias.sectorName,
        description: `Indice sectoriel BRVM. Sociétés classées « ${alias.sectorName} » en base — pondérations officielles N/D.`,
      };
    }
  }

  if (/COMPOSITE|BRVM[_-]?30|PRESTIGE|PRINCIPAL/.test(hay)) {
    return {
      family: "principal",
      compositionKind: "unavailable",
      description: "Indice principal BRVM. Composition officielle N/D en base.",
    };
  }

  if (/BRVM/.test(hay)) {
    return {
      family: "sectoriel",
      compositionKind: "unavailable",
      description: "Indice BRVM suivi en base. Composition officielle N/D.",
    };
  }

  return {
    family: "autre",
    compositionKind: "unavailable",
    description: "Indice suivi en base. Composition officielle non disponible.",
  };
}

export function isHeadlineIndex(code: string): boolean {
  return (HEADLINE_INDEX_CODES as readonly string[]).includes(code.toUpperCase());
}

export function familySortRank(family: IndexFamily): number {
  if (family === "principal") return 0;
  if (family === "sectoriel") return 1;
  return 2;
}
