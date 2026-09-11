import { describe, expect, it } from "vitest";
import { changeClassName, changeTone, formatSignedPercent } from "./format-change";

describe("format-change", () => {
  it("marks missing values as N/D", () => {
    expect(formatSignedPercent(null)).toBe("N/D");
    expect(formatSignedPercent(undefined)).toBe("N/D");
    expect(formatSignedPercent(Number.NaN)).toBe("N/D");
    expect(changeTone(null)).toBe("nd");
    expect(changeClassName(null)).toBe("ob-nd");
  });

  it("formats signed percents with tabular-friendly signs", () => {
    expect(formatSignedPercent(1.234)).toBe("+1.23%");
    expect(formatSignedPercent(-0.4)).toBe("-0.40%");
    expect(formatSignedPercent(0)).toBe("0.00%");
    expect(changeTone(2)).toBe("up");
    expect(changeTone(-1)).toBe("down");
    expect(changeTone(0)).toBe("flat");
  });
});
