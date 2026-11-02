import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiNotFound, apiValidationError, cacheHeaders } from "@/lib/api/response";
export const dynamic = "force-dynamic";
const query = z.object({ exchange: z.enum(["BRVM", "NGX"]).default("BRVM"), page: z.coerce.number().int().min(1).default(1) });
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const company = await prisma.company.findFirst({ where: { ticker: params.ticker.toUpperCase(), exchange: parsed.data.exchange }, select: { id: true } });
  if (!company) return apiNotFound("Société");
  const where = { companyId: company.id }; const pageSize = 50;
  const [total, rows] = await Promise.all([prisma.companyDocument.count({ where }), prisma.companyDocument.findMany({ where,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }], take: pageSize, skip: (parsed.data.page - 1) * pageSize })]);
  return apiSuccess({ exchange: parsed.data.exchange, ticker: params.ticker.toUpperCase(), items: rows.map((r) => ({
    title: r.title ?? "N/D", url: r.url, type: r.docType ?? "N/D", period: r.periodLabel ?? "N/D",
    publishedAt: r.publishedAt?.toISOString().slice(0, 10) ?? null, collectedAt: r.createdAt.toISOString(), source: r.sourceName,
  })), pagination: { page: parsed.data.page, pageSize, total, hasMore: parsed.data.page * pageSize < total } }, { headers: cacheHeaders(60) });
}
