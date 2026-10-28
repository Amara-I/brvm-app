// Lecture défensive des fondamentaux NGX stockés sans migration :
//  - chiffre d'affaires / résultat d'exploitation / résultat net : table financial_ratios
//    (colonnes revenue, operatingIncome, netIncome). Pour une société NGX, l'unité est le
//    MILLIARD DE NAIRAS (₦ bn) et non les Mds FCFA historiques de la BRVM.
//  - titres en circulation, capitaux propres, BPA publié, confiance de lecture : JSON companies.profile_meta.ngxFundamentals.
//    Le nombre de titres (annuaire NGX) est celui d'AUJOURD'HUI : il ne sert qu'à la capitalisation, jamais à un BPA ou un actif net passé.
// Toute valeur absente reste null : rien n'est déduit ni inventé.

export interface NgxProfileFundamentals {
  /** Nombre de titres en circulation (unités). */
  sharesOutstanding: {
    value: number;
    asOf: string | null;
    sourceUrl: string | null;
  } | null;
  /** Données complémentaires par exercice, clé = année. */
  years: Record<number, NgxYearExtras>;
  profile: {
    website: string | null;
    headOffice: string | null;
    chiefExecutive: string | null;
    employees: number | null;
    freeFloatPercent: number | null;
    foundedYear: number | null;
    sourceUrl: string | null;
  } | null;
}

/** Niveau de confiance de la lecture d'une valeur (chargeur NGX). « high » = confirmée par la colonne comparative de l'exercice suivant. */
export type NgxConfidence = "high" | "medium" | "low";

export interface NgxYearExtras {
  /** Capitaux propres part du groupe, en milliards de ₦. */
  equityBn: number | null;
  /** BPA publié, en ₦ par action. */
  epsNgn: number | null;
  /** Confiance des capitaux propres ; null si le chargement ne l'a pas enregistrée. */
  equityConfidence: NgxConfidence | null;
  /** Confiance du BPA publié ; null si non enregistrée. */
  epsConfidence?: NgxConfidence | null;
  sourceUrl: string | null;
}

export interface NgxFinancialYear {
  year: number;
  revenueBn: number | null;
  operatingIncomeBn: number | null;
  netIncomeBn: number | null;
  equityBn: number | null;
  /** Confiance des capitaux propres de l'exercice (null = non enregistrée). */
  equityConfidence: NgxConfidence | null;
  /** BPA publié uniquement. Jamais déduit du nombre de titres actuel : il a pu changer depuis. */
  epsNgn: number | null;
  /** Confiance du BPA (donc de la lecture du compte de résultat de l'exercice) ; null = non enregistrée. */
  epsConfidence?: NgxConfidence | null;
  /**
   * Nombre de titres de l'exercice, déduit des comptes (résultat net ÷ BPA publié). Sert uniquement à
   * ramener les capitaux propres de l'exercice par action ; null si le BPA ou le résultat manque.
   */
  eraShares: number | null;
  sourceUrl: string | null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeUrl(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function confidence(value: unknown): NgxConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseNgxProfileMeta(meta: unknown): NgxProfileFundamentals {
  const empty: NgxProfileFundamentals = {
    sharesOutstanding: null,
    years: {},
    profile: null,
  };
  const root = record(meta);
  const f = record(root?.ngxFundamentals);
  if (!f) return empty;

  const sharesRaw = record(f.sharesOutstanding);
  const sharesValue = num(sharesRaw?.value);
  const sharesOutstanding =
    sharesRaw && sharesValue != null && sharesValue > 0
      ? {
          value: sharesValue,
          asOf: str(sharesRaw.asOf),
          sourceUrl: safeUrl(sharesRaw.sourceUrl),
        }
      : null;

  const years: Record<number, NgxYearExtras> = {};
  const yearsRaw = record(f.years);
  if (yearsRaw) {
    for (const [key, raw] of Object.entries(yearsRaw)) {
      const year = Number(key);
      const row = record(raw);
      if (!Number.isInteger(year) || year < 1990 || year > 2100 || !row) continue;
      years[year] = {
        equityBn: num(row.equityBn),
        epsNgn: num(row.epsNgn),
        equityConfidence: confidence(row.equityConfidence),
        epsConfidence: confidence(row.epsConfidence),
        sourceUrl: safeUrl(row.sourceUrl),
      };
    }
  }

  const p = record(f.profile);
  const profile = p
    ? {
        website: safeUrl(p.website),
        headOffice: str(p.headOffice),
        chiefExecutive: str(p.chiefExecutive),
        employees: num(p.employees),
        freeFloatPercent: num(p.freeFloatPercent),
        foundedYear: num(p.foundedYear),
        sourceUrl: safeUrl(p.sourceUrl),
      }
    : null;

  return { sharesOutstanding, years, profile };
}

export interface RatioRowLike {
  year: number;
  revenue: unknown;
  operatingIncome: unknown;
  netIncome: unknown;
  isCanonical: boolean;
  source: string;
}

const SOURCE_RANK: Record<string, number> = {
  NGX_OFFICIEL: 0,
  MANUEL: 1,
  OUESTBOURSE: 2,
};

function rank(row: RatioRowLike): number {
  return (row.isCanonical ? 0 : 10) + (SOURCE_RANK[row.source] ?? 5);
}

/** Une ligne par exercice (canonique d'abord), 10 derniers exercices maximum, ordre croissant. */
export function buildFinancialYears(
  rows: readonly RatioRowLike[],
  meta: NgxProfileFundamentals,
  options: { maxYears?: number } = {},
): NgxFinancialYear[] {
  const maxYears = options.maxYears ?? 10;
  const best = new Map<number, RatioRowLike>();
  for (const row of rows) {
    const current = best.get(row.year);
    if (!current || rank(row) < rank(current)) best.set(row.year, row);
  }
  const allYears = new Set<number>([...best.keys(), ...Object.keys(meta.years).map(Number)]);

  const out: NgxFinancialYear[] = [];
  for (const year of [...allYears].sort((a, b) => a - b)) {
    const row = best.get(year);
    const extra = meta.years[year];
    const revenueBn = num(row?.revenue);
    const operatingIncomeBn = num(row?.operatingIncome);
    const netIncomeBn = num(row?.netIncome);
    const eps = extra?.epsNgn ?? null;
    // Titres de l'exercice : seulement si résultat et BPA publiés sont non nuls et de même signe.
    const eraShares =
      netIncomeBn != null && eps != null && netIncomeBn !== 0 && eps !== 0 && netIncomeBn > 0 === eps > 0
        ? (netIncomeBn * 1e9) / eps
        : null;
    out.push({
      year,
      revenueBn,
      operatingIncomeBn,
      netIncomeBn,
      equityBn: extra?.equityBn ?? null,
      equityConfidence: extra?.equityConfidence ?? null,
      epsNgn: eps,
      epsConfidence: extra?.epsConfidence ?? null,
      eraShares,
      sourceUrl: extra?.sourceUrl ?? null,
    });
  }
  const useful = out.filter(
    (y) => y.revenueBn != null || y.operatingIncomeBn != null || y.netIncomeBn != null || y.equityBn != null,
  );
  return useful.slice(-maxYears);
}
