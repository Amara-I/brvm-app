import { describe, expect, it } from "vitest";
import { annualPointStorageDate } from "./connectors/sikafinance_connector";
import {
  lastHistosQuote,
  mapSikaHistosToQuotes,
  parseSikaAazIndices,
  parseSikaAazQuotes,
  parseSikaHomepageIndices,
  parseSikaSymbolMap,
} from "./sika-market-parser";

const AAZ_HTML = `
<table id="tabQuotes2">
  <thead>
    <tr>
      <th>Nom</th><th>Ouverture</th><th>+Haut</th><th>+Bas</th><th>Dernier</th><th>Variation</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="allf"><a href="/marches/cotation_BRVMC">BRVM COMPOSITE</a></td>
      <td>552.75</td><td>552.75</td><td>552.75</td><td>552.75</td>
      <td><span class="quote_up2">0.18%</span></td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_BRVM30">BRVM 30</a></td>
      <td>267.73</td><td>267.73</td><td>267.73</td><td>267.73</td>
      <td>0.31%</td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_SIKATR">SIKA TOTAL RETURN</a></td>
      <td>598.15</td><td>598.15</td><td>598.15</td><td>598.15</td>
      <td>0.18%</td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_CAPIBRVM">Capitalisation BRVM</a></td>
      <td>21316886</td><td>21316886</td><td>21316886</td><td>21316886</td>
      <td>0.18%</td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_BRVMSP">BRVM - SERVICES PUBLICS</a></td>
      <td>777.90</td><td>777.90</td><td>777.90</td><td>777.90</td>
      <td>-0.22%</td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_BRVM-SP">BRVM - SERVICES PUBLICS</a></td>
      <td>99.60</td><td>99.60</td><td>99.60</td><td>99.60</td>
      <td>-0.51%</td>
    </tr>
  </tbody>
</table>
<table id="tblShare">
  <thead>
    <tr>
      <th>Nom</th><th>Ouverture</th><th>+Haut</th><th>+Bas</th>
      <th>Volume (titres)</th><th>Volume (XOF)</th><th>Dernier</th><th>Variation</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="allf"><a href="/marches/cotation_SNTS.sn">SONATEL</a></td>
      <td>38&#xA0;800</td><td>39&#xA0;005</td><td>38&#xA0;800</td>
      <td>14&#xA0;503</td><td>565&#xA0;689&#xA0;515</td>
      <td><b>39&#xA0;005</b></td>
      <td class="quote_up2">0.53%</td>
    </tr>
    <tr>
      <td class="allf"><a href="/marches/cotation_BOAB.bj">BANK OF AFRICA BENIN</a></td>
      <td>10&#xA0;200</td><td>10&#xA0;200</td><td>10&#xA0;030</td>
      <td>10&#xA0;963</td><td>109&#xA0;958&#xA0;890</td>
      <td><b>10&#xA0;030</b></td>
      <td class="quote_down2">-1.67%</td>
    </tr>
  </tbody>
</table>
`;

describe("annualPointStorageDate", () => {
  it("normalise les années passées au 31/12", () => {
    expect(annualPointStorageDate("02/01/2015", new Date("2026-08-12T00:00:00Z"))).toBe("2015-12-31");
  });

  it("ancre l'année courante à asOf (évite le pic au 01/01 Sika)", () => {
    expect(annualPointStorageDate("01/01/2026", new Date("2026-08-21T00:00:00Z"))).toBe("2026-08-21");
    expect(annualPointStorageDate("12/08/2026", new Date("2026-08-12T00:00:00Z"))).toBe("2026-08-12");
  });
});

describe("parseSikaSymbolMap / A–Z", () => {
  it("extrait TICKER.cc depuis les liens cotation", () => {
    const map = parseSikaSymbolMap(AAZ_HTML);
    expect(map.get("SNTS")).toBe("SNTS.sn");
    expect(map.get("BOAB")).toBe("BOAB.bj");
    expect(map.has("BRVMC")).toBe(false);
  });

  it("prend Dernier (pas +Haut) et ignore les indices sans suffixe pays", () => {
    const quotes = parseSikaAazQuotes(AAZ_HTML);
    expect(quotes.map((q) => q.ticker).sort()).toEqual(["BOAB", "SNTS"]);
    const snts = quotes.find((q) => q.ticker === "SNTS");
    expect(snts?.closePrice).toBe(39005);
    expect(snts?.volume).toBe(14503);
    expect(snts?.changePercent).toBeCloseTo(0.53, 2);
    const boab = quotes.find((q) => q.ticker === "BOAB");
    expect(boab?.closePrice).toBe(10030);
    expect(boab?.sikaSymbol).toBe("BOAB.bj");
  });

  it("lit les indices A–Z avec codes alignés BRVM et ignore la capitalisation", () => {
    const indices = parseSikaAazIndices(AAZ_HTML);
    expect(indices.find((i) => i.code === "BRVM_COMPOSITE")?.value).toBe(552.75);
    expect(indices.find((i) => i.code === "BRVM_30")?.value).toBe(267.73);
    expect(indices.find((i) => i.code === "SIKA_TOTAL_RETURN")?.value).toBe(598.15);
    expect(indices.some((i) => i.label.toLowerCase().includes("capitalisation"))).toBe(false);
    const publics = indices.filter((i) => i.label.includes("SERVICES PUBLICS"));
    expect(publics).toHaveLength(2);
    expect(new Set(publics.map((i) => i.code)).size).toBe(2);
  });
});

describe("parseSikaHomepageIndices", () => {
  it("mappe BRVMC / SIKATR depuis .mkcol", () => {
    const html = `
      <div class="mkcol">
        <a class="mkname" href="/marches/cotation_BRVMC">BRVM COMP</a>
        <span class="mkprice">552,75</span>
        <span class="mkvar mkup">0,18%</span>
      </div>
      <div class="mkcol">
        <a class="mkname" href="/marches/cotation_SIKATR">SIKA TOTAL RETURN</a>
        <span class="mkprice">154,68</span>
        <span class="mkvar">0,27%</span>
      </div>
    `;
    const indices = parseSikaHomepageIndices(html);
    expect(indices).toEqual([
      expect.objectContaining({ code: "BRVM_COMPOSITE", value: 552.75 }),
      expect.objectContaining({ code: "SIKA_TOTAL_RETURN", value: 154.68 }),
    ]);
  });
});

describe("mapSikaHistosToQuotes", () => {
  it("convertit lst GetHistos et retient le dernier close", () => {
    const quotes = mapSikaHistosToQuotes(
      "SNTS",
      [
        { Date: "09/09/2026", Close: 38800, Volume: 1000 },
        { Date: "10/09/2026", Close: 39005, Volume: 14503 },
        { Date: "11/09/2026", Close: 40000, Volume: 1 },
      ],
      { dateMax: "2026-09-10", fetchedAt: "2026-09-10T18:00:00.000Z" }
    );
    expect(quotes).toHaveLength(2);
    expect(lastHistosQuote(quotes)).toEqual(
      expect.objectContaining({ ticker: "SNTS", date: "2026-09-10", closePrice: 39005, volume: 14503 })
    );
  });

  it("ignore lst vide / nodata", () => {
    expect(mapSikaHistosToQuotes("SNTS", "", { fetchedAt: "x" })).toEqual([]);
    expect(mapSikaHistosToQuotes("SNTS", undefined, { fetchedAt: "x" })).toEqual([]);
  });
});
