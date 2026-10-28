import { describe, expect, it } from "vitest";
import { parsePage, parseRow, parseToken, splitPages } from "./text";

describe("parseToken", () => {
  it("handles thousands separators, parentheses, dashes", () => {
    expect(parseToken("1,234,567")).toBe(1234567);
    expect(parseToken("(1,234)")).toBe(-1234);
    expect(parseToken("-")).toBe(0);
    expect(parseToken("5.95")).toBe(5.95);
  });
});

describe("parseRow", () => {
  it("splits label and numeric columns, negative in parentheses", () => {
    const r = parseRow("Interest expense                         8     (133,183)    (152,342)      (13)    (14)");
    expect(r.label).toBe("Interest expense");
    expect(r.nums).toEqual([8, -133183, -152342, -13, -14]);
  });
  it("keeps a leading bullet dash as part of the label (not as a zero column)", () => {
    const r = parseRow("                – Basic                              21      5.95    6.14   3.01   0.28");
    expect(r.label).toBe("– Basic");
    expect(r.nums).toEqual([21, 5.95, 6.14, 3.01, 0.28]);
  });
});

describe("parsePage", () => {
  it("merges an untitled total row with the label printed right under it", () => {
    const text = [
      "Minimum tax                      18     (8,282)    (3,362)   (21)  (22)",
      "                                       350,593    154,540   15,171  19,461",
      "Profit before income tax",
      "",
      "Income tax expense               18    (40,111)   (18,229)   (1)   (1)",
    ].join("\n");
    const rows = parsePage(text);
    expect(rows[1].label).toBe("Profit before income tax");
    expect(rows[1].nums[0]).toBe(350593);
  });
  it("uses reverse-label mode only when the label systematically sits under the numbers", () => {
    const lines: string[] = [];
    for (let i = 0; i < 6; i++) lines.push(`      1,${100 + i},000     9${10 + i},000`, `Line item ${"ABCDEF"[i]}`);
    const rows = parsePage(lines.join("\n"));
    expect(rows[0].label).toBe("Line item A");
    expect(rows[10].label).toBe("Line item F");
  });
  it("splitPages splits on form feed", () => {
    expect(splitPages("a\fb\fc")).toHaveLength(3);
  });
});

describe("space thousands and ligatures (step 2 fixes)", () => {
  it("reads « 1 519 697 » as 1,519,697 (Fidelity 2025 layout)", async () => {
    const { parseRow } = await import("./text");
    const r = parseRow("Gross earnings                      1 519 697     1 215 123");
    expect(r.nums).toEqual([1519697, 1215123]);
  });
  it("fixes the « fi » ligature (Jaiz « Pro¿t »)", async () => {
    const { fixLigatures, parseRow } = await import("./text");
    expect(fixLigatures("Pro\uF001t for the year")).toBe("Profit for the year");
    expect(parseRow("Pro\uFB01t for the year      4,299,228   3,100,000").label).toBe("Profit for the year");
  });
});

import { unsquashLabel } from "./text";
describe("unsquashLabel", () => {
  it("splits glued words made only of lexicon words", () => {
    expect(unsquashLabel("Profit beforetax")).toBe("Profit before tax");
    expect(unsquashLabel("Totalequity")).toBe("Total equity");
    expect(unsquashLabel("Profit forthe year")).toBe("Profit for the year");
  });
  it("leaves normal words alone", () => {
    expect(unsquashLabel("Administrative expenses")).toBe("Administrative expenses");
    expect(unsquashLabel("Property, plant and equipment")).toBe("Property, plant and equipment");
    expect(unsquashLabel("Shareholders' equity")).toBe("Shareholders' equity");
  });
});

describe("parseRow OCR repairs", () => {
  it("repairs a dot used as thousands separator and 'Resuits'", () => {
    const r = parseRow("Profit for the year          33.723,730        7,924,968");
    expect(r.nums).toEqual([33723730, 7924968]);
    expect(parseRow("Resuits from operating activities     55,698,373   38,213,337").label).toBe("Results from operating activities");
  });
});

describe("OCR dotted thousands", () => {
  it("repairs dots used as thousands separators (Dangote Sugar FY2018)", () => {
    const r = parseRow("Revenue                         150.373.083           204,422,379            146,549.176   198.120.639");
    expect(r.nums).toEqual([150373083, 204422379, 146549176, 198120639]);
    const o = parseRow("Otherincome   11     569.237      401.686      234,074      196,233");
    expect(o.nums.slice(-4)).toEqual([569237, 401686, 234074, 196233]);
  });
  it("leaves genuine decimals alone", () => {
    expect(parseRow("Basic EPS (Naira)       2.835     1.250").nums).toEqual([2.835, 1.25]);
  });
});

describe("OCR typo repairs (Dangote Sugar FY2018)", () => {
  it("repairs 'vear' and 'Januarv'", () => {
    expect(parseRow("Profit for the vear        25.830.941     37,822,609").label).toBe("Profit for the year");
    expect(parseRow("Balanceasat1Januarv2017     6,000,000    6,320,524   62,264,226   74,584,750").label).toContain("1January2017");
  });
});
