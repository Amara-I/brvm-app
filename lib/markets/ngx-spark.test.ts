import { describe, expect, it } from "vitest";
import { ngxSparkValues } from "./ngx-spark";

const pt = (time: string, value: number) => ({ time, value, volume: null });

describe("ngxSparkValues", () => {
  it("retourne [] sous 2 points", () => {
    expect(ngxSparkValues([])).toEqual([]);
    expect(ngxSparkValues([pt("2026-10-01", 10)])).toEqual([]);
  });
  it("démarre à la séance la plus proche avant J-365", () => {
    const pts = [pt("2025-09-20", 5), pt("2025-10-27", 10), pt("2026-03-01", 12), pt("2026-10-28", 20)];
    // J-365 de 2026-10-28 = 2025-10-28 → référence 2025-10-27 (10), pas 2025-09-20.
    expect(ngxSparkValues(pts)).toEqual([10, 12, 20]);
  });
  it("ignore une référence trop ancienne (> 10 jours) et démarre dans la fenêtre", () => {
    const pts = [pt("2025-06-01", 5), pt("2025-12-01", 8), pt("2026-10-28", 20)];
    expect(ngxSparkValues(pts)).toEqual([8, 20]);
  });
  it("réduit les longues séries en gardant premier et dernier points", () => {
    const pts = Array.from({ length: 300 }, (_, i) => pt(new Date(Date.UTC(2025, 11, 1) + i * DAY).toISOString().slice(0, 10), 100 + i));
    const out = ngxSparkValues(pts, 48);
    expect(out).toHaveLength(48);
    expect(out[0]).toBe(100);
    expect(out[47]).toBe(399);
  });
});
const DAY = 24 * 3600 * 1000;
