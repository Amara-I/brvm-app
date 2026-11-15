import { describe, expect, it } from "vitest";
import { mergeTipPoints, tipLastDayCorrected } from "./refresh-chart-series";

const p = (time: string, value: number) => ({ time, value, volume: null });

describe("tipLastDayCorrected", () => {
  it("détecte une correction de la dernière séance du cache (même date, autre cours)", () => {
    const cached = [p("2026-11-11", 40000), p("2026-11-12", 40000)];
    const raw = [p("2026-11-11", 40000), p("2026-11-12", 42945)];
    expect(tipLastDayCorrected(cached, raw, [])).toBe(true);
    const merged = mergeTipPoints({ cached, cachedFingerprint: "none", newRaw: [], contextRaw: raw, actions: [] });
    expect(merged.points.at(-1)).toEqual(p("2026-11-12", 42945));
  });

  it("aucune correction : rien à réécrire", () => {
    const cached = [p("2026-11-12", 42945)];
    expect(tipLastDayCorrected(cached, [p("2026-11-12", 42945)], [])).toBe(false);
    expect(tipLastDayCorrected(cached, [], [])).toBe(false);
    expect(tipLastDayCorrected([], [p("2026-11-12", 1)], [])).toBe(false);
  });
});
