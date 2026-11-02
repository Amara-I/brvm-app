import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({ company: { findFirst: vi.fn(async () => ({ id: "c1" })) }, companyDocument: {
  count: vi.fn(async () => 1), findMany: vi.fn(async () => [{ title: "Rapport", url: "https://doclib.ngxgroup.com/report.pdf", docType: "ANNUAL_REPORT", periodLabel: "2025", publishedAt: null, createdAt: new Date("2026-11-01"), sourceName: "NGX officiel" }]),
} }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { GET } from "@/app/api/companies/[ticker]/documents/route";
it("lit les rapports NGX et distingue collecte/publication inconnue", async () => {
  const res = await GET(new NextRequest("https://example.org/api/companies/MTNN/documents?exchange=NGX"), { params: { ticker: "mtnn" } });
  expect(db.company.findFirst).toHaveBeenCalledWith({ where: { ticker: "MTNN", exchange: "NGX" }, select: { id: true } });
  const data = (await res.json()).data; expect(data.items[0].publishedAt).toBeNull();
  expect(data.items[0].collectedAt).toBe("2026-11-01T00:00:00.000Z"); expect(data.pagination.hasMore).toBe(false);
});
