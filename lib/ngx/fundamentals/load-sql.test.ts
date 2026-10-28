import { describe, expect, it } from "vitest";
import { buildCompanySql, buildRollbackSql, plannedTickers, q } from "./load-sql";
import type { LoadPlan } from "./load-plan";

const plan: LoadPlan = {
  ratios: [{ ticker: "GTCO", year: 2024, revenue: 1500.456, operatingIncome: null, netIncome: 500.2 }],
  meta: [{ ticker: "GTCO", year: 2024, equityBn: 1200.12345, epsNgn: 14.5, sourceUrl: "https://doclib.ngxgroup.com/a b's.pdf" }],
  dividends: [{ ticker: "GTCO", year: 2024, amount: 3.5, sourceUrl: "" }],
  documents: [{ ticker: "GTCO", year: 2024, url: "https://doclib.ngxgroup.com/x'y.pdf", filename: "x.pdf" }],
  skipped: [],
};

describe("buildCompanySql", () => {
  const { sql, counts } = buildCompanySql(plan, "GTCO");
  it("is transactional and insert-only", () => {
    expect(sql.startsWith("BEGIN;")).toBe(true);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
    expect((sql.match(/ON CONFLICT .* DO NOTHING/g) ?? []).length).toBe(3);
    expect(counts).toEqual({ ratios: 1, meta: 1, dividends: 1, documents: 1 });
  });
  it("targets NGX companies, source NGX_OFFICIEL and canonical rows", () => {
    expect(sql).toContain("exchange = 'NGX'");
    expect(sql).toContain("'NGX_OFFICIEL'::data_source, true");
    expect(sql).toContain("(2024, 1500.46::numeric, NULL::numeric, 500.2::numeric)");
  });
  it("merges profile_meta with || and keeps existing years", () => {
    expect(sql).toMatch(/COALESCE\(profile_meta, '\{\}'::jsonb\) \|\| jsonb_build_object\('ngxFundamentals'/);
    expect(sql).toContain("|| COALESCE(profile_meta->'ngxFundamentals'->'years'");
    expect(sql).toContain('"equityBn":1200.123');
  });
  it("escapes quotes", () => {
    expect(q("a'b")).toBe("'a''b'");
    expect(sql).toContain("x''y.pdf");
  });
  it("rejects hostile tickers", () => {
    expect(() => buildCompanySql(plan, "X'; DROP")).toThrow();
  });
  it("rollback only deletes ngx-* ids of source NGX", () => {
    const rb = buildRollbackSql(plannedTickers(plan));
    expect(rb).toContain("source = 'NGX_OFFICIEL' AND id LIKE 'ngx-fr-%'");
    expect(rb).toContain("source_name = 'NGX' AND id LIKE 'ngx-doc-%'");
  });
});
