import { describe, expect, it } from "vitest";
import { downsampleLttb } from "./downsample";
import type { ChartClosePoint } from "./indicators";

function line(n: number): ChartClosePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    time: `2020-01-${String((i % 28) + 1).padStart(2, "0")}`,
    value: i + (i === 50 ? 500 : 0),
    volume: 1,
  }));
}

describe("downsampleLttb", () => {
  it("ne touche pas une série déjà courte", () => {
    const pts = line(10);
    expect(downsampleLttb(pts, 40)).toEqual(pts);
  });

  it("conserve premier, dernier, et réduit le nombre de points", () => {
    const pts = line(200);
    const out = downsampleLttb(pts, 40);
    expect(out).toHaveLength(40);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
    expect(out.some((p) => p.value === 550)).toBe(true);
  });
});
