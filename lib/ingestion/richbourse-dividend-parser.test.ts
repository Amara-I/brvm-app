import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRichbourseDividendCalendar } from "./richbourse-dividend-parser";

const MINIMAL_RB_HTML = `
<script>window.rbSimData = [{"s":"SGBC","n":"SGBCI","m":2293.28,"x":"2026-08-21","p":"2026-08-24","o":1},{"s":"SNTS","n":"SONATEL","m":1740,"x":"2026-05-22","p":"2026-05-26","o":1}];</script>
`;

describe("parseRichbourseDividendCalendar", () => {
  it("extrait SGBC et SNTS depuis window.rbSimData", () => {
    const rows = parseRichbourseDividendCalendar(MINIMAL_RB_HTML);
    const sgbc = rows.find((r) => r.ticker === "SGBC");
    expect(sgbc?.amount).toBeCloseTo(2293.28, 1);
    expect(sgbc?.exDate).toBe("2026-08-21");
    expect(sgbc?.paymentDate).toBe("2026-08-24");
    const snts = rows.find((r) => r.ticker === "SNTS");
    expect(snts?.amount).toBe(1740);
    expect(snts?.exDate).toBe("2026-05-22");
  });

  const htmlPath = join(process.cwd(), ".cache/richbourse-dividende-index.html");
  it.skipIf(!existsSync(htmlPath))("extrait SGBC et SNTS depuis le HTML Richbourse en cache", () => {
    const html = readFileSync(htmlPath, "utf8");
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
