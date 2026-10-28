import { describe, expect, it } from "vitest";
import { bestDividend, extractDividends } from "./dividends";

describe("extractDividends", () => {
  it("reads a proposed final dividend and the prior-year comparative from a sentence", () => {
    const text = "Subsequent to the year end, the Directors proposed a final dividend of 280k per share (Dec 2021: 270k per share) subject to approval.";
    const c = extractDividends(text, 2022);
    const final = c.find((x) => x.kind === "final" && x.fiscalYear === 2022);
    expect(final?.dps).toBeCloseTo(2.8, 6);
    expect(c.find((x) => x.fiscalYear === 2021)?.dps).toBeCloseTo(2.7, 6);
  });
  it("prefers a total over partial candidates", () => {
    const best = bestDividend([
      { fiscalYear: 2022, dps: 2.8, kind: "final", source: "text", page: 1, snippet: "" },
      { fiscalYear: 2022, dps: 3.1, kind: "total", source: "text", page: 2, snippet: "", derived: true },
    ]);
    expect(best?.dps).toBe(3.1);
  });
  it("returns null without candidates", () => {
    expect(bestDividend([])).toBeNull();
  });
});
