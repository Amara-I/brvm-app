import { describe, expect, it } from "vitest";
import {
  availableHeroRanges,
  buildHeroGeometry,
  cleanHeroSeries,
  downsampleHeroSeries,
  heroChangePercent,
  nearestHeroIndex,
  sliceHeroRange,
  type HeroPoint,
} from "./hero-chart";

function daily(from: string, days: number, fn: (i: number) => number): HeroPoint[] {
  const out: HeroPoint[] = [];
  const t0 = Date.parse(`${from}T00:00:00.000Z`);
  for (let i = 0; i < days; i++) {
    out.push({ time: new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), value: fn(i) });
  }
  return out;
}

describe("hero-chart", () => {
  it("cleanHeroSeries retire valeurs invalides, doublons, et trie", () => {
    const out = cleanHeroSeries([
      { time: "2026-01-03", value: 12 },
      { time: "2026-01-01", value: 10 },
      { time: "2026-01-02", value: NaN },
      { time: "2026-01-04", value: 0 },
      { time: "bad", value: 5 },
      { time: "2026-01-03", value: 13 },
    ]);
    expect(out).toEqual([
      { time: "2026-01-01", value: 10 },
      { time: "2026-01-03", value: 13 },
    ]);
  });

  it("availableHeroRanges ne propose que les périodes couvertes", () => {
    const six = daily("2020-06-01", 365 * 6, (i) => 100 + i);
    expect(availableHeroRanges(six)).toEqual(["1Y", "3Y", "5Y"]);
    const two = daily("2024-06-01", 365 * 2, (i) => 100 + i);
    expect(availableHeroRanges(two)).toEqual(["1Y"]);
    const short = daily("2026-06-01", 60, (i) => 100 + i);
    expect(availableHeroRanges(short)).toEqual(["MAX"]);
    expect(availableHeroRanges([])).toEqual([]);
  });

  it("sliceHeroRange démarre au dernier point <= borne", () => {
    const s = daily("2020-01-01", 365 * 6, (i) => 100 + i);
    const last = s[s.length - 1]!.time;
    const win = sliceHeroRange(s, "1Y");
    const cutoff = new Date(`${last}T00:00:00.000Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    expect(win[0]!.time).toBe(cutoff.toISOString().slice(0, 10));
    expect(win[win.length - 1]!.time).toBe(last);
    expect(sliceHeroRange(s, "MAX")).toHaveLength(s.length);
  });

  it("heroChangePercent", () => {
    expect(heroChangePercent([{ time: "2026-01-01", value: 100 }, { time: "2026-01-02", value: 150 }])).toBeCloseTo(50);
    expect(heroChangePercent([{ time: "2026-01-01", value: 100 }])).toBeNull();
  });

  it("downsample garde premier/dernier points, min et max réels, et reste ordonné", () => {
    const s = daily("2021-01-01", 1500, (i) => 100 + (i % 97) + (i === 777 ? 500 : 0) - (i === 1200 ? 90 : 0));
    const out = downsampleHeroSeries(s, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out[0]).toEqual(s[0]);
    expect(out[out.length - 1]).toEqual(s[s.length - 1]);
    expect(Math.max(...out.map((p) => p.value))).toBe(Math.max(...s.map((p) => p.value)));
    expect(Math.min(...out.map((p) => p.value))).toBe(Math.min(...s.map((p) => p.value)));
    for (let i = 1; i < out.length; i++) expect(out[i]!.time > out[i - 1]!.time).toBe(true);
    // Tous les points sont des points d'origine (pas d'interpolation).
    const set = new Set(s.map((p) => `${p.time}|${p.value}`));
    expect(out.every((p) => set.has(`${p.time}|${p.value}`))).toBe(true);
  });

  it("buildHeroGeometry : axe Y borné au min/max + marge, pas de zéro forcé", () => {
    const s = daily("2025-01-01", 10, (i) => 200 + i * 10);
    const g = buildHeroGeometry(s, 500, 200)!;
    expect(g.dataMin).toBe(200);
    expect(g.dataMax).toBe(290);
    expect(g.yMin).toBeGreaterThan(150);
    expect(g.yMax).toBeLessThan(340);
    expect(g.linePath.startsWith("M0.0 ")).toBe(true);
    expect(g.xPct[0]).toBe(0);
    expect(g.xPct[g.xPct.length - 1]).toBeCloseTo(100);
    // Série montante : dernier point plus haut (y plus petit) que le premier.
    expect(g.yPct[g.yPct.length - 1]!).toBeLessThan(g.yPct[0]!);
    expect(buildHeroGeometry([s[0]!], 500, 200)).toBeNull();
  });

  it("nearestHeroIndex", () => {
    expect(nearestHeroIndex([0, 25, 50, 100], 0.3)).toBe(1);
    expect(nearestHeroIndex([0, 25, 50, 100], 2)).toBe(3);
    expect(nearestHeroIndex([0, 25, 50, 100], -1)).toBe(0);
  });
});
