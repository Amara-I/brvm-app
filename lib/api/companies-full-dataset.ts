// ═══════════════════════════════════════════════════════════════════════════
// Jeu de données complet pour le dashboard — étape 8 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Reconstitue la forme de `COMPANIES_FULL` (reference/BRVM_Dashboard.jsx) à
// partir des données CANONIQUES en base (post-réconciliation multi-source :
// cf. lib/ingestion/reconciliation.ts), avec deux champs additionnels absents
// du JSX d'origine — `dataSource` et `lastSyncedAt` — répondant au brief :
// "Ajouter un indicateur discret de source des données et dernière
// synchronisation par société".
//
// Utilisé par :
//   - `app/page.tsx` (Server Component) : appel DIRECT de cette fonction pour
//     le premier rendu, sans aller-retour HTTP superflu (pas de self-fetch).
//   - `GET /api/companies/full` : lecture seule du dataset en base.
//   - `POST /api/market/refresh-quotes` : tire d'abord les cours BRVM du
//     jour, puis renvoie ce même dataset (bouton "⟳ Actualiser").
// ═══════════════════════════════════════════════════════════════════════════

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface CompanyFullDataset {
  ticker: string;
  name: string;
  country: string;
  countryFlag: string;
  sector: string;
  per: number;
  mktcap: number;
  /// ROE % — null si absent en base (affichage "N/D").
  roe: number | null;
  /// Marge nette % — null si absent.
  netMargin: number | null;
  /// Ratio d'endettement % — null si absent.
  debtRatio: number | null;
  /// Price-to-Book — null si absent.
  pbRatio: number | null;
  /// Croissance CA % YoY — null si absent.
  revenueGrowth: number | null;
  /// Free Cash Flow (Md FCFA) — null si absent.
  fcf: number | null;
  /// Valeurs de l'exercice précédent (pour colonnes « Précédent » / Variation).
  prevPer: number | null;
  prevMktcap: number | null;
  prevRoe: number | null;
  prevNetMargin: number | null;
  prevDebtRatio: number | null;
  prevPbRatio: number | null;
  prevRevenueGrowth: number | null;
  prevFcf: number | null;
  /// Cours de clôture canonique par année. Absent/0 = non coté cette année-là.
  prices: Record<number, number>;
  /// Dividende par action canonique par année.
  dividends: Record<number, number>;
  color: string;
  /// Source de la donnée canonique la plus récente pour cette société (cours
  /// OU dividende, la plus récente des deux), ou `null` si aucune donnée
  /// canonique n'existe encore pour elle.
  dataSource: string | null;
  /// Horodatage ISO de l'ingestion de cette donnée la plus récente, ou `null`.
  lastSyncedAt: string | null;
}

type RatioFields = {
  per: number | null;
  mktCap: number | null;
  roe: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  pbRatio: number | null;
  revenueGrowth: number | null;
  fcf: number | null;
};

const SOURCE_RANK: Record<string, number> = {
  BRVM_OFFICIEL: 0,
  SIKAFINANCE: 1,
  OUESTBOURSE: 2,
  RICHBOURSE: 3,
  MANUEL: 4,
};

/** PER officiel BRVM : >0 uniquement ; 0 ou null = non publié / non significatif. */
function parsePerValue(per: unknown): number | null {
  if (per == null) return null;
  const n = Number(per);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Le PER affiché suit la source de vérité BRVM : si une ligne BRVM existe pour
 * l'année, on n'emprunte jamais le PER Sikafinance (évite SICC : BRVM=0, Sika≈249).
 */
function perForRatioRow(
  row: { year: number; source: string; per: unknown },
  brvmYears: Set<number>
): number | null {
  if (row.source === "BRVM_OFFICIEL") return parsePerValue(row.per);
  if (brvmYears.has(row.year)) return null;
  return parsePerValue(row.per);
}

const RATIO_KEYS = [
  "per",
  "mktCap",
  "roe",
  "netMargin",
  "debtRatio",
  "pbRatio",
  "revenueGrowth",
  "fcf",
] as const;

/** Fusionne les ratios multi-années : chaque champ prend la valeur non-nulle la plus récente, puis la précédente. */
function coalesceRatioHistory(
  rows: Array<{ year: number } & RatioFields>
): { current: RatioFields; previous: RatioFields } {
  const byYear = new Map<number, RatioFields>();
  for (const r of rows) {
    const cur = byYear.get(r.year) ?? {
      per: null,
      mktCap: null,
      roe: null,
      netMargin: null,
      debtRatio: null,
      pbRatio: null,
      revenueGrowth: null,
      fcf: null,
    };
    for (const k of RATIO_KEYS) {
      if (cur[k] == null && r[k] != null) {
        if (k === "per" && r[k]! <= 0) continue;
        cur[k] = r[k];
      }
    }
    byYear.set(r.year, cur);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const current: RatioFields = {
    per: null,
    mktCap: null,
    roe: null,
    netMargin: null,
    debtRatio: null,
    pbRatio: null,
    revenueGrowth: null,
    fcf: null,
  };
  const previous: RatioFields = {
    per: null,
    mktCap: null,
    roe: null,
    netMargin: null,
    debtRatio: null,
    pbRatio: null,
    revenueGrowth: null,
    fcf: null,
  };
  const yearOf = {} as Record<(typeof RATIO_KEYS)[number], number | undefined>;

  for (const y of years) {
    const row = byYear.get(y)!;
    for (const k of RATIO_KEYS) {
      if (row[k] == null) continue;
      if (k === "per" && row[k]! <= 0) continue;
      if (current[k] == null) {
        current[k] = row[k];
        yearOf[k] = y;
      } else if (previous[k] == null && yearOf[k] != null && y < yearOf[k]!) {
        previous[k] = row[k];
      }
    }
  }
  return { current, previous };
}

export interface CompaniesFullDataset {
  /// Années couvertes par au moins une société (triées croissant) — remplace
  /// le tableau `YEARS` codé en dur du JSX d'origine, désormais dérivé des
  /// données réellement en base.
  years: number[];
  companies: CompanyFullDataset[];
  generatedAt: string;
}

export async function loadCompaniesFullDataset(): Promise<CompaniesFullDataset> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    include: { country: true, sector: true },
    orderBy: { name: "asc" },
  });
  const companyIds = companies.map((c) => c.id);
  const ratioYearMin = new Date().getUTCFullYear() - 8;

  // Un seul point de cours / société / année (dernier non futur) —
  // évite de charger ~160k lignes quotidiennes à chaque page.
  const [priceRows, dividendRows, ratioRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        company_id: string;
        year: number;
        close_price: unknown;
        source: string;
        ingested_at: Date;
      }>
    >`
      SELECT DISTINCT ON (ph.company_id, EXTRACT(YEAR FROM ph.date)::int)
        ph.company_id,
        EXTRACT(YEAR FROM ph.date)::int AS year,
        ph.close_price,
        ph.source::text AS source,
        ph.ingested_at
      FROM price_history ph
      WHERE ph.is_canonical = true
        AND ph.date <= CURRENT_DATE
        AND ph.company_id = ANY(${companyIds})
      ORDER BY
        ph.company_id,
        EXTRACT(YEAR FROM ph.date)::int,
        ph.date DESC,
        ph.ingested_at DESC
    `,
    prisma.dividend.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      select: { companyId: true, year: true, amount: true, source: true, createdAt: true },
    }),
    prisma.financialRatio.findMany({
      where: { companyId: { in: companyIds }, year: { gte: ratioYearMin } },
      orderBy: [{ companyId: "asc" }, { year: "desc" }],
      select: {
        companyId: true,
        year: true,
        source: true,
        per: true,
        mktCap: true,
        roe: true,
        netMargin: true,
        debtRatio: true,
        pbRatio: true,
        revenueGrowth: true,
        fcf: true,
      },
    }),
  ]);

  const yearsSet = new Set<number>();
  const pricesByCompany = new Map<string, Record<number, number>>();
  const syncFromDisplayedPrice = new Map<string, { source: string; at: Date }>();

  for (const row of priceRows) {
    const year = Number(row.year);
    yearsSet.add(year);
    const close = Number(row.close_price);
    const bucket = pricesByCompany.get(row.company_id) ?? {};
    bucket[year] = close;
    pricesByCompany.set(row.company_id, bucket);

    const prev = syncFromDisplayedPrice.get(row.company_id);
    if (!prev || year > new Date(prev.at).getUTCFullYear()) {
      // On préfère le millésime le plus récent pour la provenance affichée.
      syncFromDisplayedPrice.set(row.company_id, { source: row.source, at: row.ingested_at });
    }
  }

  // Corrige la source sync : vraiment le max year
  for (const [companyId, bucket] of pricesByCompany) {
    const years = Object.keys(bucket).map(Number);
    const maxYear = Math.max(...years);
    const row = priceRows.find((r) => r.company_id === companyId && Number(r.year) === maxYear);
    if (row) {
      syncFromDisplayedPrice.set(companyId, { source: row.source, at: row.ingested_at });
    }
  }

  const dividendsByCompany = new Map<string, Record<number, number>>();
  for (const row of dividendRows) {
    yearsSet.add(row.year);
    const bucket = dividendsByCompany.get(row.companyId) ?? {};
    bucket[row.year] = Number(row.amount);
    dividendsByCompany.set(row.companyId, bucket);
    if (!syncFromDisplayedPrice.has(row.companyId)) {
      syncFromDisplayedPrice.set(row.companyId, { source: row.source, at: row.createdAt });
    }
  }

  const ratiosByCompany = new Map<string, Array<{ year: number } & RatioFields>>();
  const brvmRatioYearsByCompany = new Map<string, Set<number>>();
  for (const row of ratioRows) {
    if (row.source !== "BRVM_OFFICIEL") continue;
    const set = brvmRatioYearsByCompany.get(row.companyId) ?? new Set<number>();
    set.add(row.year);
    brvmRatioYearsByCompany.set(row.companyId, set);
  }
  const sortedRatios = [...ratioRows].sort((a, b) => {
    if (a.companyId !== b.companyId) return a.companyId.localeCompare(b.companyId);
    if (a.year !== b.year) return b.year - a.year;
    return (SOURCE_RANK[a.source] ?? 9) - (SOURCE_RANK[b.source] ?? 9);
  });
  for (const row of sortedRatios) {
    const list = ratiosByCompany.get(row.companyId) ?? [];
    const brvmYears = brvmRatioYearsByCompany.get(row.companyId) ?? new Set<number>();
    list.push({
      year: row.year,
      per: perForRatioRow(row, brvmYears),
      mktCap: row.mktCap != null ? Number(row.mktCap) : null,
      roe: row.roe != null ? Number(row.roe) : null,
      netMargin: row.netMargin != null ? Number(row.netMargin) : null,
      debtRatio: row.debtRatio != null ? Number(row.debtRatio) : null,
      pbRatio: row.pbRatio != null ? Number(row.pbRatio) : null,
      revenueGrowth: row.revenueGrowth != null ? Number(row.revenueGrowth) : null,
      fcf: row.fcf != null ? Number(row.fcf) : null,
    });
    ratiosByCompany.set(row.companyId, list);
  }
  const years = [...yearsSet].sort((a, b) => a - b);

  const result: CompanyFullDataset[] = companies.map((co) => {
    const { current, previous } = coalesceRatioHistory(ratiosByCompany.get(co.id) ?? []);
    const sync = syncFromDisplayedPrice.get(co.id);
    return {
      ticker: co.ticker,
      name: co.name,
      country: co.country.name,
      countryFlag: co.country.flagEmoji,
      sector: co.sector.name,
      per: current.per ?? 0,
      mktcap: current.mktCap ?? 0,
      roe: current.roe,
      netMargin: current.netMargin,
      debtRatio: current.debtRatio,
      pbRatio: current.pbRatio,
      revenueGrowth: current.revenueGrowth,
      fcf: current.fcf,
      prevPer: previous.per,
      prevMktcap: previous.mktCap,
      prevRoe: previous.roe,
      prevNetMargin: previous.netMargin,
      prevDebtRatio: previous.debtRatio,
      prevPbRatio: previous.pbRatio,
      prevRevenueGrowth: previous.revenueGrowth,
      prevFcf: previous.fcf,
      prices: pricesByCompany.get(co.id) ?? {},
      dividends: dividendsByCompany.get(co.id) ?? {},
      color: co.color,
      dataSource: sync?.source ?? null,
      lastSyncedAt: sync?.at.toISOString() ?? null,
    };
  });

  return { years, companies: result, generatedAt: new Date().toISOString() };
}

const getCachedCompaniesFullDataset = unstable_cache(loadCompaniesFullDataset, ["companies-full-dataset"], {
  revalidate: 60,
  tags: ["companies-full"],
});

/** Déduplique au sein d'une même requête RSC + cache 60s entre requêtes. */
export const getCompaniesFullDataset = cache(getCachedCompaniesFullDataset);
