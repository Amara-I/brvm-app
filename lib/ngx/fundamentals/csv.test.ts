import { describe, expect, it } from "vitest";
import { csvCell, toCsv, yearRanges } from "./csv";

describe("csv helpers", () => {
  it("quotes cells containing commas, quotes and newlines", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
    expect(csvCell(1.5)).toBe("1.5");
  });
  it("writes a header and rows", () => {
    expect(toCsv([{ a: 1, b: "x,y" }], ["a", "b"])).toBe('a,b\n1,"x,y"\n');
  });
  it("compresses year lists into ranges", () => {
    expect(yearRanges([2016, 2017, 2018, 2020, 2022, 2023])).toBe("2016-2018, 2020, 2022-2023");
  });
});
