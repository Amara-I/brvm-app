/** Enrichissements pédagogiques fusionnés (détails + sources citées). */

export type TermEnrichment = {
  details: string;
  sources: { title: string; url: string }[];
};

import { ENRICHMENTS_PART1 } from "./enrichments-part1";
import { ENRICHMENTS_PART2 } from "./enrichments-part2";
import { ENRICHMENTS_PART3 } from "./enrichments-part3";

export const TERM_ENRICHMENTS: Record<string, TermEnrichment> = {
  ...ENRICHMENTS_PART1,
  ...ENRICHMENTS_PART2,
  ...ENRICHMENTS_PART3,
};
