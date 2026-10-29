// Synthèse des perspectives d'avenir NGX : lecture de companies.profile_meta.ngxOutlook.
// Logique partagée avec la BRVM : voir lib/outlook/synthesis.ts.

import {
  OUTLOOK_TYPES,
  outlookSummary,
  outlookText,
  parseOutlook,
  type OutlookItem,
  type OutlookSummary,
  type OutlookSynthesis,
} from "../outlook/synthesis";

export const NGX_OUTLOOK_TYPES = OUTLOOK_TYPES;
export type NgxOutlookItemType = (typeof NGX_OUTLOOK_TYPES)[number];
export type NgxOutlookItem = OutlookItem;
export type NgxOutlookSummary = OutlookSummary;
export type NgxOutlookSynthesis = OutlookSynthesis;

export { outlookSummary, outlookText };

/** null = aucune synthèse exploitable (la fiche affiche alors un état vide). */
export function parseNgxOutlook(meta: unknown): NgxOutlookSynthesis | null {
  return parseOutlook(meta, "ngxOutlook");
}
