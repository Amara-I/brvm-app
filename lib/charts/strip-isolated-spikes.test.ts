import { describe, expect, it } from "vitest";
import { stripIsolatedPriceSpikes } from "./strip-isolated-spikes";

describe("stripIsolatedPriceSpikes", () => {
  it("retire un pic isolé type SNTS 2026-01-01", () => {
    const series = [
      { time: "2025-12-30", value: 24400 },
      { time: "2025-12-31", value: 26120 },
      { time: "2026-01-01", value: 36980 },
      { time: "2026-01-02", value: 25995 },
      { time: "2026-01-05", value: 24995 },
    ];
    const out = stripIsolatedPriceSpikes(series);
    expect(out.map((p) => p.time)).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-02",
      "2026-01-05",
    ]);
  });

  it("conserve une vraie tendance (hausse progressive)", () => {
    const series = [
      { time: "2026-01-01", value: 100 },
      { time: "2026-01-02", value: 110 },
      { time: "2026-01-03", value: 120 },
      { time: "2026-01-04", value: 130 },
    ];
    expect(stripIsolatedPriceSpikes(series)).toEqual(series);
  });
});
