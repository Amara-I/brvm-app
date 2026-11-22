import { describe, expect, it } from "vitest";
import { parseBrvmIndicesPage, parseBrvmQuotesPage } from "./brvm-market-parser";

const QUOTES_HTML = `
<table>
  <thead><tr><th>Top 5</th><th>Cours</th><th>Variation</th></tr></thead>
  <tbody><tr><td>NEIC</td><td>2 825</td><td>7,41%</td></tr></tbody>
</table>
<table>
  <thead>
    <tr>
      <th>Symbole</th><th>Nom</th><th>Volume</th>
      <th>Cours veille (FCFA)</th><th>Cours Ouverture (FCFA)</th>
      <th>Cours Clôture (FCFA)</th><th>Variation (%)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>SNTS</td><td>SONATEL SENEGAL</td><td class="text-right">14 503</td>
      <td>38 800</td><td>38 800</td><td>39 005</td>
      <td><span class="text-good">0,53</span></td>
    </tr>
    <tr>
      <td>BOAB</td><td>BOA BENIN</td><td>10 963</td>
      <td>10 200</td><td>10 200</td><td>10 030</td>
      <td>-1,67</td>
    </tr>
  </tbody>
</table>
`;

const QUOTES_REORDERED_HTML = `
<table>
  <thead>
    <tr>
      <th>Variation (%)</th><th>Cours Clôture (FCFA)</th><th>Volume</th>
      <th>Nom</th><th>Symbole</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>0,53</td><td>39 005</td><td>14 503</td><td>SONATEL</td><td>SNTS</td></tr>
  </tbody>
</table>
`;

const INDICES_HTML = `
<section id="block-tools-indices">
  <table>
    <thead>
      <tr>
        <th>Nom</th><th>Fermeture précédente</th><th>Fermeture</th>
        <th>Variation (%)</th><th>Variation 31 décembre (%)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>BRVM-30</td><td>266,89</td><td>267,73</td>
        <td>0,31</td><td>1,97</td>
      </tr>
      <tr>
        <td>BRVM - COMPOSITE</td><td>551,76</td><td>552,75</td>
        <td>0,18</td><td>1,70</td>
      </tr>
    </tbody>
  </table>
</section>
`;

describe("parseBrvmQuotesPage", () => {
  it("ignore le Top 5 et lit Symbole / Clôture / Volume par en-tête", () => {
    const parsed = parseBrvmQuotesPage(QUOTES_HTML, "2026-09-10");
    expect(parsed.tableFound).toBe(true);
    expect(parsed.quotes).toHaveLength(2);
    const snts = parsed.quotes.find((q) => q.ticker === "SNTS");
    expect(snts?.closePrice).toBe(39005);
    expect(snts?.volume).toBe(14503);
    expect(snts?.prevClose).toBe(38800);
    expect(snts?.changePercent).toBeCloseTo(0.53, 2);
    const boab = parsed.quotes.find((q) => q.ticker === "BOAB");
    expect(boab?.closePrice).toBe(10030);
  });

  it("reste correct si les colonnes sont réordonnées", () => {
    const parsed = parseBrvmQuotesPage(QUOTES_REORDERED_HTML, "2026-09-10");
    expect(parsed.quotes).toEqual([
      expect.objectContaining({ ticker: "SNTS", closePrice: 39005, volume: 14503 }),
    ]);
  });

  it("signale l'absence de tableau de cours", () => {
    const parsed = parseBrvmQuotesPage("<html><p>maintenance</p></html>", "2026-09-10");
    expect(parsed.tableFound).toBe(false);
    expect(parsed.quotes).toEqual([]);
  });
});

describe("parseBrvmIndicesPage", () => {
  it("normalise BRVM-30 et BRVM Composite depuis Fermeture (pas la veille)", () => {
    const parsed = parseBrvmIndicesPage(INDICES_HTML, "2026-09-10");
    expect(parsed.tableFound).toBe(true);
    expect(parsed.indices.find((i) => i.code === "BRVM_30")?.value).toBe(267.73);
    expect(parsed.indices.find((i) => i.code === "BRVM_COMPOSITE")?.value).toBe(552.75);
    expect(parsed.indices.find((i) => i.code === "BRVM_COMPOSITE")?.changePercent).toBeCloseTo(0.18, 2);
  });
});

describe("alias de symboles BRVM", () => {
  it("rattache le symbole officiel BBGC au ticker interne BBGCI", () => {
    const html = `
<table>
  <thead><tr><th>Symbole</th><th>Nom</th><th>Volume</th><th>Cours veille (FCFA)</th><th>Cours Clôture (FCFA)</th><th>Variation (%)</th></tr></thead>
  <tbody>
    <tr><td>BBGC</td><td>BRIDGE BANK GROUP CI</td><td>9 592</td><td>8 500</td><td>8 145</td><td>-4,18</td></tr>
    <tr><td>SNTS</td><td>SONATEL SENEGAL</td><td>738 457</td><td>4 090</td><td>4 040</td><td>-1,22</td></tr>
  </tbody>
</table>`;
    const { quotes } = parseBrvmQuotesPage(html, "2026-11-20");
    expect(quotes.map((q) => q.ticker)).toEqual(["BBGCI", "SNTS"]);
    expect(quotes[0]).toMatchObject({ ticker: "BBGCI", closePrice: 8145, volume: 9592, prevClose: 8500 });
  });

  it("laisse inchangés les symboles sans alias", async () => {
    const { internalTickerForBrvmSymbol } = await import("./brvm-issuer-ticker");
    expect(internalTickerForBrvmSymbol("bbgc")).toBe("BBGCI");
    expect(internalTickerForBrvmSymbol("SNTS")).toBe("SNTS");
  });
});
