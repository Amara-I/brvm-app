import { describe, expect, it } from "vitest";
import { buildConfidenceBackfillSql, buildConfidencePreviewSql, collectYearConfidences } from "./confidence-sql";
import type { FundamentalsCsvRow } from "./load-plan";

const row = (over: Record<string, string>) =>
  ({
    ticker: "GTCO", fiscal_year: "2024", currency: "NGN", revenue_bn: "1", operating_profit_bn: "1", net_profit_bn: "1", equity_bn: "2712.018", eps: "35.44",
    conf_revenue: "high", conf_operating_profit: "high", conf_net_profit: "high", conf_equity: "high", conf_eps: "medium",
    source_pdf: "", source_file: "", ...over,
  }) as unknown as FundamentalsCsvRow;

describe("confidence backfill SQL", () => {
  it("retient la confiance des valeurs présentes, ignore les non-NGN et les doublons", () => {
    const m = collectYearConfidences([
      row({}),
      row({ conf_equity: "low" }), // doublon : la première ligne gagne
      row({ fiscal_year: "2023", eps: "", conf_eps: "none" }),
      row({ ticker: "ETI", currency: "USD" }),
    ]);
    expect([...m.keys()]).toEqual(["GTCO"]);
    expect(m.get("GTCO")).toEqual([
      { year: 2023, equity: 2712.018, confEquity: "high", eps: null, confEps: null },
      { year: 2024, equity: 2712.018, confEquity: "high", eps: 35.44, confEps: "medium" },
    ]);
  });
  it("n'ajoute que les deux clés de confiance, sans insertion ni suppression", () => {
    const sql = buildConfidenceBackfillSql([row({})]);
    expect(sql).toMatch(/^-- .*NON EXÉCUTÉ/);
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("'equityConfidence'");
    expect(sql).toContain("'epsConfidence'");
    expect(sql).toContain("abs((y.value->>'equityBn')::numeric - v.equity)");
    expect(sql).not.toMatch(/\b(DELETE|INSERT|DROP|TRUNCATE)\b/i);
    expect(sql).toContain("WHERE c.exchange = 'NGX' AND c.ticker = 'GTCO'");
  });
  it("la prévisualisation est un SELECT en lecture seule", () => {
    const sql = buildConfidencePreviewSql([row({})]);
    expect(sql).toMatch(/^SELECT c\.ticker/);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/i);
  });
  it("refuse un ticker non sûr", () => {
    expect(() => collectYearConfidences([row({ ticker: "A'; DROP" })])).toThrow();
  });
});
