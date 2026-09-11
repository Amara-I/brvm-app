// Index léger pour le header / méga-menu — NE PAS charger l'historique complet.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { seedCompaniesNavIndex } from "@/lib/api/offline-seed-dataset";

export type NavCompany = {
  ticker: string;
  name: string;
  sector: string;
  countryFlag: string;
  lastPrice: number | null;
};

async function loadCompaniesNavIndex(): Promise<{
  companies: NavCompany[];
  sectorGroups: SectorGroup[];
}> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: { select: { name: true } },
      country: { select: { flagEmoji: true } },
    },
    orderBy: { name: "asc" },
  });

  // Dernier cours canonique non futur — 1 ligne / société (pas tout l'historique).
  const latest = await prisma.$queryRaw<Array<{ company_id: string; close_price: unknown }>>`
    SELECT DISTINCT ON (ph.company_id)
      ph.company_id,
      ph.close_price
    FROM price_history ph
    WHERE ph.is_canonical = true
      AND ph.date <= CURRENT_DATE
    ORDER BY ph.company_id, ph.date DESC
  `;
  const lastById = new Map(
    latest.map((r) => [r.company_id, Number(r.close_price)])
  );

  const navCompanies: NavCompany[] = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector.name,
    countryFlag: c.country.flagEmoji,
    lastPrice: lastById.get(c.id) ?? null,
  }));

  const bySector = new Map<string, SectorGroup["companies"]>();
  for (const co of navCompanies) {
    const list = bySector.get(co.sector) ?? [];
    list.push({
      ticker: co.ticker,
      name: co.name,
      countryFlag: co.countryFlag,
      lastPrice: co.lastPrice,
    });
    bySector.set(co.sector, list);
  }

  const sectorGroups = [...bySector.entries()]
    .map(([sector, list]) => ({
      sector,
      companies: list.sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "fr"));

  return { companies: navCompanies, sectorGroups };
}

const getCachedNavIndex = unstable_cache(loadCompaniesNavIndex, ["companies-nav-index"], {
  revalidate: 60,
  tags: ["companies-nav"],
});

/** Déduplique les appels au sein d'une même requête RSC.
 *  Base injoignable : seed en développement, menu vide en production. */
export const getCompaniesNavIndex = cache(async () => {
  try {
    return await getCachedNavIndex();
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error(
      "[companies-nav] base injoignable —",
      process.env.NODE_ENV === "production" ? "menu vide" : "repli seed local",
      err instanceof Error ? err.message : err
    );
    if (process.env.NODE_ENV === "production") {
      return { companies: [] as NavCompany[], sectorGroups: [] as SectorGroup[] };
    }
    return seedCompaniesNavIndex();
  }
});
