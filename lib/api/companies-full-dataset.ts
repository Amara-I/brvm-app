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
//   - `GET /api/companies/full` : pour les rafraîchissements côté client
//     (bouton "⟳ Actualiser les données" du dashboard).
//
// ⚠️ Tant que le cron d'ingestion (étape 6) n'a pas tourné en conditions
// réelles, seules les données seedées (2015-2026, `source: MANUEL`, cf.
// prisma/seed.ts) sont disponibles.
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";

export interface CompanyFullDataset {
  ticker: string;
  name: string;
  country: string;
  countryFlag: string;
  sector: string;
  per: number;
  mktcap: number;
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

export interface CompaniesFullDataset {
  /// Années couvertes par au moins une société (triées croissant) — remplace
  /// le tableau `YEARS` codé en dur du JSX d'origine, désormais dérivé des
  /// données réellement en base.
  years: number[];
  companies: CompanyFullDataset[];
  generatedAt: string;
}

export async function getCompaniesFullDataset(): Promise<CompaniesFullDataset> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    include: { country: true, sector: true },
    orderBy: { name: "asc" },
  });
  const companyIds = companies.map((c) => c.id);

  const [priceRows, dividendRows, ratioRows] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      select: { companyId: true, date: true, closePrice: true, source: true, ingestedAt: true },
    }),
    prisma.dividend.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      select: { companyId: true, year: true, amount: true, source: true, createdAt: true },
    }),
    prisma.financialRatio.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      orderBy: [{ companyId: "asc" }, { year: "desc" }],
      distinct: ["companyId"],
      select: { companyId: true, per: true, mktCap: true },
    }),
  ]);

  const yearsSet = new Set<number>();
  const pricesByCompany = new Map<string, Record<number, number>>();
  const lastSyncByCompany = new Map<string, { source: string; at: Date }>();

  for (const row of priceRows) {
    const year = row.date.getUTCFullYear();
    yearsSet.add(year);
    const bucket = pricesByCompany.get(row.companyId) ?? {};
    bucket[year] = Number(row.closePrice);
    pricesByCompany.set(row.companyId, bucket);

    const current = lastSyncByCompany.get(row.companyId);
    if (!current || row.ingestedAt > current.at) {
      lastSyncByCompany.set(row.companyId, { source: row.source, at: row.ingestedAt });
    }
  }

  const dividendsByCompany = new Map<string, Record<number, number>>();
  for (const row of dividendRows) {
    yearsSet.add(row.year);
    const bucket = dividendsByCompany.get(row.companyId) ?? {};
    bucket[row.year] = Number(row.amount);
    dividendsByCompany.set(row.companyId, bucket);

    // Les dividendes n'ont pas de champ `ingestedAt` dédié (seulement
    // `createdAt`, cf. schema.prisma) — traité comme une synchronisation
    // au même titre qu'un cours pour déterminer la source la plus "fraîche".
    const current = lastSyncByCompany.get(row.companyId);
    if (!current || row.createdAt > current.at) {
      lastSyncByCompany.set(row.companyId, { source: row.source, at: row.createdAt });
    }
  }

  const ratioByCompany = new Map(ratioRows.map((r) => [r.companyId, r]));
  const years = [...yearsSet].sort((a, b) => a - b);

  const result: CompanyFullDataset[] = companies.map((co) => {
    const ratio = ratioByCompany.get(co.id);
    const sync = lastSyncByCompany.get(co.id);
    return {
      ticker: co.ticker,
      name: co.name,
      country: co.country.name,
      countryFlag: co.country.flagEmoji,
      sector: co.sector.name,
      per: ratio?.per !== null && ratio?.per !== undefined ? Number(ratio.per) : 0,
      mktcap: ratio?.mktCap !== null && ratio?.mktCap !== undefined ? Number(ratio.mktCap) : 0,
      prices: pricesByCompany.get(co.id) ?? {},
      dividends: dividendsByCompany.get(co.id) ?? {},
      color: co.color,
      dataSource: sync?.source ?? null,
      lastSyncedAt: sync?.at.toISOString() ?? null,
    };
  });

  return { years, companies: result, generatedAt: new Date().toISOString() };
}
