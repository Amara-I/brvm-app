import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), latest: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { priceAlert: { findMany: m.findMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/db/latest-canonical", () => ({ loadLatestCanonicalPrice: m.latest }));

import { evaluateActivePriceAlerts } from "./evaluate-price-alerts";

beforeEach(() => {
  vi.resetAllMocks();
  m.findMany.mockResolvedValue([
    { id: "a1", userId: "u1", companyId: "c-mtnn", ticker: "MTNN", direction: "ABOVE", targetPrice: 320, company: { exchange: "NGX" } },
  ]);
  m.latest.mockResolvedValue(new Map([["c-mtnn", { companyId: "c-mtnn", closePrice: 330.5 }]]));
});

describe("evaluateActivePriceAlerts", () => {
  it("filtre par place et déclenche une alerte NGX une seule fois", async () => {
    m.updateMany.mockResolvedValue({ count: 1 });
    const res = await evaluateActivePriceAlerts({ exchanges: ["NGX"] });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE", company: { exchange: { in: ["NGX"] } } });
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ id: "a1", status: "ACTIVE" });
    expect(res.fired).toEqual([expect.objectContaining({ id: "a1", exchange: "NGX", triggerPrice: 330.5 })]);
  });

  it("évaluation concurrente : la transition déjà prise ailleurs ne renotifie pas", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    const res = await evaluateActivePriceAlerts();
    expect(res.fired).toEqual([]);
    expect(res.triggered).toBe(0);
  });
});
