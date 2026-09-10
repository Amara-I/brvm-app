import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBrvmIssuerResolver } from "./brvm-issuer-ticker";
import { parseBrvmDividendPage } from "./brvm-dividend-parser";
import { parseFrenchDate } from "./parse-utils";

describe("parseFrenchDate", () => {
  it("parse une date française", () => {
    expect(parseFrenchDate("10 septembre 2026")).toBe("2026-09-10");
    expect(parseFrenchDate("31 août 2025")).toBe("2025-08-31");
  });
});

describe("parseBrvmDividendPage", () => {
  const resolve = buildBrvmIssuerResolver([
    { ticker: "NEIC", name: "NEI-CEDA CI" },
    { ticker: "SGBC", name: "Société Générale CI" },
  ]);

  it("extrait NEI-CEDA depuis le HTML BRVM en cache", () => {
    const htmlPath = join(process.cwd(), ".cache/brvm-dividends.html");
    const html = readFileSync(htmlPath, "utf8");
    const rows = parseBrvmDividendPage(html, new Date().toISOString(), resolve);
    const neic = rows.find((r) => r.ticker === "NEIC" && r.year === 2025);
    expect(neic).toBeDefined();
    expect(neic!.amount).toBeCloseTo(159.54, 2);
    expect(neic!.exDate).toBe("2026-09-09");
    expect(neic!.paymentDate).toBe("2026-09-10");
    expect(neic!.source).toBe("BRVM_OFFICIEL");
  });
});

describe("buildBrvmIssuerResolver", () => {
  it("résout les alias SGCI et NESTLE CI", () => {
    const resolve = buildBrvmIssuerResolver([{ ticker: "SGBC", name: "Société Générale CI" }]);
    expect(resolve("SGCI")).toBe("SGBC");
    expect(resolve("NESTLE CI")).toBe("NTLC");
  });
});
