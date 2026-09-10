// ═══════════════════════════════════════════════════════════════════════════
// GET /api/companies/:ticker — Détail d'une société + historique complet
// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 du plan de migration.
//
// Retourne l'historique COMPLET des cours/dividendes/ratios CANONIQUES
// (post-réconciliation multi-source), chaque point de donnée portant son
// `source` d'origine pour affichage transparent côté UI (cf. contrainte du
// brief : "indicateur discret de source des données" + "dernière
// synchronisation" par société, prévu pour l'étape 8).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiNotFound, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();

  const company = await prisma.company.findUnique({
    where: { ticker },
    include: { country: true, sector: true },
  });
  if (!company) return apiNotFound(`Société "${ticker}"`);

  const [priceHistory, dividends, financialRatios] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true, source: true, ingestedAt: true },
    }),
    prisma.dividend.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { year: "asc" },
      select: { year: true, amount: true, exDate: true, paymentDate: true, source: true },
    }),
    prisma.financialRatio.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { year: "asc" },
      select: {
        year: true,
        per: true,
        mktCap: true,
        roe: true,
        netMargin: true,
        debtRatio: true,
        pbRatio: true,
        revenueGrowth: true,
        fcf: true,
        source: true,
      },
    }),
  ]);

  const lastSyncedAt = priceHistory.reduce<string | null>((latest, p) => {
    const iso = p.ingestedAt.toISOString();
    return !latest || iso > latest ? iso : latest;
  }, null);

  return apiSuccess(
    {
      company: {
        ticker: company.ticker,
        name: company.name,
        isin: company.isin,
        color: company.color,
        logoUrl: company.logoUrl,
        description: company.description,
        listedSince: company.listedSince?.toISOString().slice(0, 10) ?? null,
        isActive: company.isActive,
        country: { code: company.country.code, name: company.country.name, flag: company.country.flagEmoji },
        sector: { name: company.sector.name, slug: company.sector.slug },
      },
      // Donnée manquante → tableau vide (le front affiche déjà "N/D" pour
      // les années sans cours, cf. contrainte non négociable du JSX).
      priceHistory: priceHistory.map((p) => ({
        date: p.date.toISOString().slice(0, 10),
        closePrice: Number(p.closePrice),
        volume: p.volume !== null ? Number(p.volume) : null,
        source: p.source,
      })),
      dividends: dividends.map((d) => ({
        year: d.year,
        amount: Number(d.amount),
        exDate: d.exDate?.toISOString().slice(0, 10) ?? null,
        paymentDate: d.paymentDate?.toISOString().slice(0, 10) ?? null,
        source: d.source,
      })),
      financialRatios: financialRatios.map((r) => ({
        year: r.year,
        per: r.per !== null ? Number(r.per) : "N/D",
        mktCap: r.mktCap !== null ? Number(r.mktCap) : "N/D",
        roe: r.roe !== null ? Number(r.roe) : "N/D",
        netMargin: r.netMargin !== null ? Number(r.netMargin) : "N/D",
        debtRatio: r.debtRatio !== null ? Number(r.debtRatio) : "N/D",
        pbRatio: r.pbRatio !== null ? Number(r.pbRatio) : "N/D",
        revenueGrowth: r.revenueGrowth !== null ? Number(r.revenueGrowth) : "N/D",
        fcf: r.fcf !== null ? Number(r.fcf) : "N/D",
        source: r.source,
      })),
      lastSyncedAt,
    },
    { headers: cacheHeaders(60) }
  );
}
