import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { latestQuotesSql } from "./latest-quotes";

describe("latestQuotesSql", () => {
  it("2 dernières clôtures canoniques par société, séances futures exclues, colonnes utiles seulement", () => {
    const sql = latestQuotesSql("BRVM", null, new Date("2026-11-13T12:00:00Z"));
    const text = sql.sql.replace(/\s+/g, " ");
    expect(text).toContain("CROSS JOIN LATERAL");
    expect(text).toContain("ph.is_canonical = true");
    expect(text).toContain("ORDER BY ph.date DESC LIMIT 2");
    expect(text).not.toContain("SELECT *");
    expect(sql.values).toContain("2026-11-13");
    expect(sql.values).toContain("BRVM");
  });
  it("filtre par tickers si demandé", () => {
    const sql = latestQuotesSql("NGX", ["MTNN"]);
    expect(sql.sql).toContain("c.ticker = ANY(");
    expect(sql.values).toContainEqual(["MTNN"]);
  });
});
