import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRichbourseDividendCalendar } from "./richbourse-dividend-parser";

describe("parseRichbourseDividendCalendar", () => {
  it("extrait SGBC et SNTS depuis le HTML Richbourse en cache", () => {
    const html = readFileSync(
      join(process.cwd(), ".cache/richbourse-dividende-index.html"),
      "utf8"
    );
    const rows = parseRichbourseDividendCalendar(html);
    const sgbc = rows.find((r) => r.ticker === "SGBC");
    expect(sgbc?.amount).toBeCloseTo(2293.28, 1);
    expect(sgbc?.exDate).toBe("2026-08-21");
    expect(sgbc?.paymentDate).toBe("2026-08-24");
    const snts = rows.find((r) => r.ticker === "SNTS");
    expect(snts?.amount).toBe(1740);
    expect(snts?.exDate).toBe("2026-05-22");
  });
});
