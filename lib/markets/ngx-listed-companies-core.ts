// Annuaire NGX — types et filtre, sûrs pour le client : aucun accès base.
// Les cours et caps manquants restent null (affichés N/D). Aucun chiffre inventé.
// Les familles (Banques, Assurances, etc.) viennent de lib/ngx/sectors.ts.

import {
  NGX_SECTOR_GROUPS,
  ngxSectorGroupSlug,
  parseNgxSectorGroupSlug,
  type NgxSectorGroup,
  type NgxSectorGroupSlug,
} from "@/lib/ngx/sectors";

export interface NgxListedCompanyRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  /** Famille OuestBourse (banques séparées des assureurs). */
  category: NgxSectorGroup;
  /** Identifiant d'URL : banking, insurance, financial-services… */
  categorySlug: NgxSectorGroupSlug;
  close: number | null;
  changePercent: number | null;
  marketCapBn: number | null;
  sessionDate: string | null;
}

export interface NgxListedSectorCount {
  slug: NgxSectorGroupSlug;
  group: NgxSectorGroup;
  name: string;
  count: number;
}

export interface NgxListedCompaniesData {
  rows: NgxListedCompanyRow[];
  sectors: NgxListedSectorCount[];
  sessionDate: string | null;
  /** Somme des caps connues, en milliards de ₦. null = aucune cap en base. */
  totalCapBn: number | null;
}

export function filterNgxListedRows(
  rows: readonly NgxListedCompanyRow[],
  query: string,
  sectorSlug: string,
): NgxListedCompanyRow[] {
  const q = query.trim().toLowerCase();
  const category = parseNgxSectorGroupSlug(sectorSlug);
  return rows.filter((row) => {
    if (category && row.category !== category) return false;
    // rétrocompat : ancien slug de secteur brut
    if (!category && sectorSlug && row.sectorSlug !== sectorSlug && row.categorySlug !== sectorSlug) {
      return false;
    }
    if (!q) return true;
    return row.ticker.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });
}

export interface NgxListedCategorySection {
  group: NgxSectorGroup;
  slug: NgxSectorGroupSlug;
  rows: NgxListedCompanyRow[];
}

/** Sections dans l'ordre de la taxonomie, sans les familles vides. */
export function groupNgxListedRows(rows: readonly NgxListedCompanyRow[]): NgxListedCategorySection[] {
  const byGroup = new Map<NgxSectorGroup, NgxListedCompanyRow[]>();
  for (const row of rows) {
    const list = byGroup.get(row.category) ?? [];
    list.push(row);
    byGroup.set(row.category, list);
  }
  return NGX_SECTOR_GROUPS.flatMap((group) => {
    const list = byGroup.get(group);
    if (!list || list.length === 0) return [];
    return [{ group, slug: ngxSectorGroupSlug(group), rows: list }];
  });
}
