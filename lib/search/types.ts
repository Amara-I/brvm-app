export const SITE_SEARCH_KINDS = ["stock", "index", "education", "page"] as const;
export type SiteSearchKind = (typeof SITE_SEARCH_KINDS)[number];

export interface SiteSearchDocument {
  id: string;
  kind: SiteSearchKind;
  title: string;
  titleEn?: string;
  subtitle?: string;
  subtitleEn?: string;
  href: string;
  /** Place, quand le document en a une. Absente pour les pages transverses. */
  exchange?: string;
  /** Ticker ou code d'indice, affiché en évidence. */
  code?: string;
  keywords?: string[];
}

export interface SiteSearchHit extends SiteSearchDocument {
  score: number;
}

export interface SiteSearchGroup {
  id: string;
  kind: SiteSearchKind;
  exchange?: string;
  items: SiteSearchHit[];
}
