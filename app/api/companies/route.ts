// ═══════════════════════════════════════════════════════════════════════════
// GET /api/companies — Liste des sociétés cotées, avec filtres/tri/pagination
// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 du plan de migration.
//
// Query params (validés via Zod, cf. lib/api/query-schemas.ts) :
//   page      (défaut 1)
//   pageSize  (défaut 20, max 100)
//   sector    (slug, ex: "banques")
//   country   (code ISO2, ex: "CI")
//   sortBy    "name" | "ticker" | "mktcap" | "per" | "listedSince" (défaut "name")
//   sortDir   "asc" | "desc" (défaut "asc")
//
// Mise en cache : `Cache-Control: s-maxage=60` (les données de marché
// n'évoluent pas seconde par seconde tant que le cron d'ingestion, étape 6,
// n'est pas en place). À terme, ce cache pourra être adossé à Redis/Vercel KV
// (cf. AGENTS.md § Stack technique) sans changer le contrat de cette route.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { companiesListQuerySchema } from "@/lib/api/query-schemas";
import { getLatestCanonicalPrices, getLatestFinancialRatios } from "@/lib/api/latest-data";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic"; // dépend de la base — jamais pré-rendu statiquement

function serializeCompany(
  company: Prisma.CompanyGetPayload<{ include: { country: true; sector: true } }>,
  price: Awaited<ReturnType<typeof getLatestCanonicalPrices>> extends Map<string, infer V> ? V | undefined : never,
  ratio: Awaited<ReturnType<typeof getLatestFinancialRatios>> extends Map<string, infer V> ? V | undefined : never
) {
  return {
    ticker: company.ticker,
    name: company.name,
    color: company.color,
    logoUrl: company.logoUrl,
    isActive: company.isActive,
    country: { code: company.country.code, name: company.country.name, flag: company.country.flagEmoji },
    sector: { name: company.sector.name, slug: company.sector.slug },
    // Cf. contrainte non négociable : donnée manquante → "N/D", jamais null brut côté client.
    currentPrice: price ? Number(price.closePrice) : "N/D",
    currentPriceDate: price ? price.date.toISOString().slice(0, 10) : null,
    per: ratio?.per !== undefined && ratio.per !== null ? Number(ratio.per) : "N/D",
    mktCap: ratio?.mktCap !== undefined && ratio.mktCap !== null ? Number(ratio.mktCap) : "N/D",
    dataSource: price?.source ?? ratio?.source ?? null,
  };
}

export async function GET(request: NextRequest) {
  const parsed = companiesListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { page, pageSize, sector, country, sortBy, sortDir } = parsed.data;

  const where: Prisma.CompanyWhereInput = {
    isActive: true,
    ...(sector ? { sector: { slug: sector } } : {}),
    ...(country ? { country: { code: country } } : {}),
  };

  // `mktcap`/`per` vivent dans FinancialRatio (relation 1-N par année), donc
  // impossibles à trier nativement via `orderBy` sur Company. Avec ~50
  // sociétés cotées à la BRVM, un tri en mémoire applicative reste largement
  // suffisant en performance — à revoir seulement si le référentiel grossit
  // de façon significative.
  if (sortBy === "mktcap" || sortBy === "per") {
    const allMatching = await prisma.company.findMany({ where, include: { country: true, sector: true } });
    const ratios = await getLatestFinancialRatios(allMatching.map((c) => c.id));
    const prices = await getLatestCanonicalPrices(allMatching.map((c) => c.id));

    const sorted = allMatching
      .map((c) => ({ company: c, ratio: ratios.get(c.id) }))
      .sort((a, b) => {
        const va = sortBy === "mktcap" ? Number(a.ratio?.mktCap ?? -Infinity) : Number(a.ratio?.per ?? Infinity);
        const vb = sortBy === "mktcap" ? Number(b.ratio?.mktCap ?? -Infinity) : Number(b.ratio?.per ?? Infinity);
        return sortDir === "asc" ? va - vb : vb - va;
      });

    const totalItems = sorted.length;
    const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);
    const data = pageItems.map(({ company, ratio }) => serializeCompany(company, prices.get(company.id), ratio));

    return apiSuccess(
      { items: data, pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } },
      { headers: cacheHeaders(60) }
    );
  }

  const orderByField = sortBy === "listedSince" ? "listedSince" : sortBy; // "name" | "ticker" | "listedSince"
  const [totalItems, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      include: { country: true, sector: true },
      orderBy: { [orderByField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const companyIds = companies.map((c) => c.id);
  const [prices, ratios] = await Promise.all([getLatestCanonicalPrices(companyIds), getLatestFinancialRatios(companyIds)]);

  const data = companies.map((c) => serializeCompany(c, prices.get(c.id), ratios.get(c.id)));

  return apiSuccess(
    { items: data, pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } },
    { headers: cacheHeaders(60) }
  );
}
