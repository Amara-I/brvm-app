import { describe, expect, it } from "vitest";
import { classifySplitReflection } from "./detect";

describe("classifySplitReflection", () => {
  it("voit un historique non ajusté au saut 1/10", () => {
    expect(
      classifySplitReflection(
        [
          { time: "2026-10-23", value: 43850 },
          { time: "2026-10-26", value: 4700 },
        ],
        "2026-10-26",
        10
      )
    ).toBe("unadjusted");
  });

  it("voit un historique déjà continu", () => {
    expect(
      classifySplitReflection(
        [
          { time: "2018-12-26", value: 10000 },
          { time: "2018-12-27", value: 10200 },
        ],
        "2018-12-27",
        5
      )
    ).toBe("already_adjusted");
  });

  it("ne conclut pas sans cours avant la date", () => {
    expect(
      classifySplitReflection([{ time: "2019-11-01", value: 2000 }], "2019-10-25", 64)
    ).toBe("insufficient_history");
  });
});
