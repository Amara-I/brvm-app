// Catalogue des fractionnements BRVM connus.
// Source : https://www.brvm.org/fr/esv/fractionnement (relevé 26/10/2026).
//
// Mapping tickers (vérifié contre `prisma/seed-data/companies-full.ts`) :
// - SONATEL → SNTS
// - TRACTAFRIC CI → PRSC (Tractafric Motors CI). TTLC est TotalEnergies
//   Marketing CI, pas Tractafric : ne pas lui appliquer le 64:1.
// - SMB → SMBC
// - ECOBANK CI → ECOC
// - CROWN SIEM CI → SEMC (Eviosys Packaging)
// - SAFCA CI → SAFC
// - ONATEL BF → ONTBF
// - SITAB → STBC
//
// Quand la page BRVM liste deux dates (valeur théorique puis séance),
// la date retenue est celle d'effet en séance (la plus tardive).
// `defaultAdjust` des historiques est false : le script
// `corporate-actions:apply` ne les active qu'après avoir vu le saut de cours
// dans l'historique stocké (évite un double ajustement).

import type { CorporateActionKind } from "./types";
import { splitMarkerLabel } from "./label";

export interface CatalogSplit {
  ticker: string;
  kind: CorporateActionKind;
  effectiveDate: string;
  oldShares: number;
  newShares: number;
  nominalBefore?: number;
  nominalAfter?: number;
  sourceUrl?: string;
  note: string;
  /** Appliquer même si la table n'est pas encore migrée. */
  forceAdjust: boolean;
  /** Valeur initiale en base avant vérification de l'historique. */
  defaultAdjust: boolean;
  sharesOutstandingBefore?: number;
}

export const BRVM_SPLIT_CATALOG: CatalogSplit[] = [
  {
    ticker: "SNTS",
    kind: "SPLIT",
    effectiveDate: "2026-10-26",
    oldShares: 1,
    newShares: 10,
    nominalBefore: 500,
    nominalAfter: 50,
    sharesOutstandingBefore: 100_000_000,
    sourceUrl: "https://www.brvm.org/fr/sonatel-sn-fractionnement-de-laction",
    note: "Sonatel : 10 actions nouvelles pour 1 ancienne, nominal 500 → 50 FCFA, 100 M → 1 Md de titres. Dernier cours ancienne base : séance du 23/10/2026.",
    forceAdjust: true,
    defaultAdjust: true,
  },
  {
    ticker: "PRSC",
    kind: "SPLIT",
    effectiveDate: "2019-10-25",
    oldShares: 1,
    newShares: 64,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "Tractafric CI (PRSC), 64 pour 1. La ligne du 24/10/2019 est la valeur théorique ; effet de séance le 25/10/2019. Pas TTLC.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "SMBC",
    kind: "SPLIT",
    effectiveDate: "2019-02-25",
    oldShares: 1,
    newShares: 4,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "SMB CI, 4 pour 1, séance du 25/02/2019.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "ECOC",
    kind: "SPLIT",
    effectiveDate: "2018-12-27",
    oldShares: 1,
    newShares: 5,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "Ecobank CI, 5 pour 1, séance du 27/12/2018.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "SEMC",
    kind: "SPLIT",
    effectiveDate: "2018-12-20",
    oldShares: 1,
    newShares: 40,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "Crown SIEM CI (SEMC), 40 pour 1, séance du 20/12/2018.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "SAFC",
    kind: "SPLIT",
    effectiveDate: "2018-12-24",
    oldShares: 1,
    newShares: 5,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "SAFCA CI, 5 pour 1, séance du 24/12/2018.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "ONTBF",
    kind: "SPLIT",
    effectiveDate: "2018-08-29",
    oldShares: 1,
    newShares: 2,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "ONATEL BF, 2 pour 1, séance du 29/08/2018.",
    forceAdjust: false,
    defaultAdjust: false,
  },
  {
    ticker: "STBC",
    kind: "SPLIT",
    effectiveDate: "2018-07-27",
    oldShares: 1,
    newShares: 20,
    sourceUrl: "https://www.brvm.org/fr/esv/fractionnement",
    note: "SITAB CI, 20 pour 1. La ligne du 26/07/2018 est la valeur théorique (2 000 FCFA) ; effet de séance le 27/07/2018.",
    forceAdjust: false,
    defaultAdjust: false,
  },
];

export function catalogFactor(entry: CatalogSplit): number {
  return entry.newShares / entry.oldShares;
}

export function catalogLabel(entry: CatalogSplit): string {
  return splitMarkerLabel({
    oldShares: entry.oldShares,
    newShares: entry.newShares,
    effectiveDate: entry.effectiveDate,
  });
}
