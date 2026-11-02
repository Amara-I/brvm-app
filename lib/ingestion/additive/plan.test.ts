import { describe, expect, it } from "vitest";
import { enrichmentSchema, historyWork } from "./plan";
describe("fenêtres de rattrapage", () => {
  it("demande de vrais points journaliers par fenêtres mensuelles, sans interpolation", () => {
    expect(historyWork("BRVM", ["SNTS", "SGBC"], "2024-02-10", "2024-03-04")).toEqual([
      { ticker: "SNTS", from: "2024-02-10", to: "2024-02-29" }, { ticker: "SGBC", from: "2024-02-10", to: "2024-02-29" },
      { ticker: "SNTS", from: "2024-03-01", to: "2024-03-04" }, { ticker: "SGBC", from: "2024-03-01", to: "2024-03-04" },
    ]);
  });
  it("saute les week-ends NGX sans les fabriquer comme séances", () => {
    expect(historyWork("NGX", [], "2026-10-30", "2026-11-02").map((w) => w.from)).toEqual(["2026-10-30", "2026-11-02"]);
  });
  it("refuse les bornes invalides et simule par défaut", () => {
    expect(enrichmentSchema.parse({ exchange: "NGX" }).apply).toBe("0");
    expect(enrichmentSchema.safeParse({ exchange: "BRVM", from: "2025-02-30" }).success).toBe(false);
    expect(enrichmentSchema.safeParse({ exchange: "BRVM", from: "2026-01-01", to: "2025-01-01" }).success).toBe(false);
  });
});
