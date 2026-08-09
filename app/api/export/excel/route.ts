// ═══════════════════════════════════════════════════════════════════════════
// GET /api/export/excel — Export Excel serveur (3 feuilles), étape 5
// ═══════════════════════════════════════════════════════════════════════════
// Port de `exportToExcel()` (reference/BRVM_Dashboard.jsx) : construit le
// même classeur ("Données BRVM" / "Projections" / "Classements") à partir
// des données CANONIQUES en base (post-réconciliation multi-source), au lieu
// du tableau statique COMPANIES_FULL, et le retourne en téléchargement
// direct (`Content-Disposition: attachment`) — cf. lib/calc/export-workbook.ts
// pour le détail de la génération du classeur.
//
// Query params optionnels (façon Screener) :
//   sector  (slug BRVM, ex: "banques")   — restreint l'export à un secteur
//   country (code ISO2, ex: "CI")        — restreint l'export à un pays
//
// Tant que le cron d'ingestion (étape 6) n'est pas en place, seules les
// données seedées (2015-2026, source MANUEL, cf. prisma/seed.ts) sont
// disponibles — le fichier généré aura donc le même contenu que l'export
// JSX d'origine pour ces 20 sociétés.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api/response";
import { buildBrvmWorkbook, buildExportFileName, type ExportCompanyRow } from "@/lib/calc/export-workbook";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sector = request.nextUrl.searchParams.get("sector");
  const country = request.nextUrl.searchParams.get("country");

  const where: Prisma.CompanyWhereInput = {
    isActive: true,
    ...(sector ? { sector: { slug: sector } } : {}),
    ...(country ? { country: { code: country } } : {}),
  };

  const companies = await prisma.company.findMany({
    where,
    include: { country: true, sector: true },
    orderBy: { name: "asc" },
  });
  if (companies.length === 0) return apiError("Aucune société ne correspond aux filtres fournis", 404);

  const companyIds = companies.map((c) => c.id);

  const [priceRows, dividendRows, ratioRows] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      select: { companyId: true, date: true, closePrice: true },
    }),
    prisma.dividend.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      select: { companyId: true, year: true, amount: true },
    }),
    // Ratio le plus récent par société (comme `getLatestFinancialRatios`,
    // dupliqué ici en `select` minimal pour éviter un aller-retour Prisma
    // supplémentaire).
    prisma.financialRatio.findMany({
      where: { companyId: { in: companyIds }, isCanonical: true },
      orderBy: [{ companyId: "asc" }, { year: "desc" }],
      distinct: ["companyId"],
      select: { companyId: true, per: true, mktCap: true },
    }),
  ]);

  // Reconstitue `prices[year]`/`dividends[year]` par société, comme dans le
  // JSX d'origine (`PriceHistory.date` est le 31/12 de chaque année pour les
  // données seedées, cf. prisma/seed.ts).
  const yearsSet = new Set<number>();
  const pricesByCompany = new Map<string, Record<number, number>>();
  for (const row of priceRows) {
    const year = row.date.getUTCFullYear();
    yearsSet.add(year);
    const bucket = pricesByCompany.get(row.companyId) ?? {};
    bucket[year] = Number(row.closePrice);
    pricesByCompany.set(row.companyId, bucket);
  }

  const dividendsByCompany = new Map<string, Record<number, number>>();
  for (const row of dividendRows) {
    yearsSet.add(row.year);
    const bucket = dividendsByCompany.get(row.companyId) ?? {};
    bucket[row.year] = Number(row.amount);
    dividendsByCompany.set(row.companyId, bucket);
  }

  const years = [...yearsSet].sort((a, b) => a - b);
  if (years.length === 0) return apiError("Aucune donnée de cours/dividende canonique disponible pour générer l'export", 404);

  const ratioByCompany = new Map(ratioRows.map((r) => [r.companyId, r]));

  const rows: ExportCompanyRow[] = companies.map((co) => {
    const ratio = ratioByCompany.get(co.id);
    return {
      ticker: co.ticker,
      name: co.name,
      country: co.country.name,
      sector: co.sector.name,
      per: ratio?.per !== null && ratio?.per !== undefined ? Number(ratio.per) : 0,
      mktcap: ratio?.mktCap !== null && ratio?.mktCap !== undefined ? Number(ratio.mktCap) : 0,
      prices: pricesByCompany.get(co.id) ?? {},
      dividends: dividendsByCompany.get(co.id) ?? {},
    };
  });

  const buffer = buildBrvmWorkbook(rows, years);
  const lastUpdate = new Date().toLocaleDateString("fr-FR"); // format JJ/MM/AAAA, comme `lastUpdate` dans le JSX
  const fileName = buildExportFileName(lastUpdate);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store", // export à la demande, jamais mis en cache
    },
  });
}
