// Annuaire NGX — types et filtre, sûrs pour le client : aucun accès base.
// Les cours et caps manquants restent null (affichés N/D). Aucun chiffre inventé.

export interface NgxListedCompanyRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  close: number | null;
  changePercent: number | null;
  marketCapBn: number | null;
  sessionDate: string | null;
}

export interface NgxListedSectorCount {
  slug: string;
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
  return rows.filter((row) => {
    if (sectorSlug && row.sectorSlug !== sectorSlug) return false;
    if (!q) return true;
    return row.ticker.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });
}
