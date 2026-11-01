import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { listingCoverage } from "@/lib/markets/coverage";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import type { ListingExchange } from "@/lib/markets/listing-scope";

export const dynamic = "force-dynamic";
const query = z.object({ exchange: z.enum(["BRVM", "NGX"]).optional() });
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const now = new Date();
  const companies = await prisma.company.findMany({
    where: { isActive: true, exchange: parsed.data.exchange ?? { in: ["BRVM", "NGX"] } },
    select: { id: true, ticker: true, exchange: true, financialRatios: {
      where: { isCanonical: true, year: { gte: now.getUTCFullYear() - 10, lt: now.getUTCFullYear() } },
      select: { year: true, revenue: true, operatingIncome: true, netIncome: true },
    } }, orderBy: [{ exchange: "asc" }, { ticker: "asc" }],
  });
  const prices = await prisma.priceHistory.groupBy({
    by: ["companyId"], where: { companyId: { in: companies.map((c) => c.id) }, isCanonical: true, date: { lte: now } },
    _min: { date: true }, _max: { date: true }, _count: { _all: true },
  });
  const byId = new Map(prices.map((p) => [p.companyId, p]));
  const items = companies.map((c) => {
    const p = byId.get(c.id);
    return listingCoverage({ ticker: c.ticker, exchange: c.exchange as ListingExchange,
      firstDate: p?._min.date?.toISOString().slice(0, 10) ?? null,
      lastDate: p?._max.date?.toISOString().slice(0, 10) ?? null,
      priceCount: p?._count._all ?? 0, financials: c.financialRatios }, now.toISOString().slice(0, 10));
  });
  return apiSuccess({ asOf: now.toISOString(), total: items.length,
    criticalMissing: items.filter((i) => i.criticalMissing).length, items }, { headers: cacheHeaders(60) });
}
