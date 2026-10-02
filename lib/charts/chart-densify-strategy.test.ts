import { describe, expect, it } from "vitest";
import { planChartDensify, addCalendarDays, todayIsoUtc } from "./chart-densify-strategy";

describe("planChartDensify", () => {
  it("avec cache densifié : ne demande que le tip", () => {
    const db = Array.from({ length: 70 }, (_, i) => ({
      time: addCalendarDays("2026-01-01", i),
    }));
    const plan = planChartDensify(db, 200);
    expect(plan.mode).toBe("tip");
    if (plan.mode === "tip") {
      expect(plan.dailyFrom < db[db.length - 1]!.time).toBe(true);
    }
  });

  it("série dense sans cache : tip seulement", () => {
    const db = Array.from({ length: 80 }, (_, i) => ({
      time: addCalendarDays("2026-03-01", i),
    }));
    // dernier point = hier relatif à une série continue courte gap
    const plan = planChartDensify(db, 0);
    expect(plan.mode === "tip" || plan.mode === "none").toBe(true);
  });

  it("introduction récente : un chunk autour de la première clôture", () => {
    const first = addCalendarDays(todayIsoUtc(), -17);
    const plan = planChartDensify([{ time: first }], 0);
    expect(plan.mode).toBe("fill");
    if (plan.mode === "fill") {
      expect(plan.dailyFrom).toBe(addCalendarDays(first, -7));
      expect(plan.fetchAnnual).toBe(false);
      expect(plan.fetchRich).toBe(false);
    }
  });

  it("série ancienne d'un point : fenêtre journalière 2024+", () => {
    const plan = planChartDensify([{ time: "2018-12-31" }], 0);
    expect(plan.mode).toBe("fill");
    if (plan.mode === "fill") {
      expect(plan.dailyFrom).toBe("2024-01-01");
    }
  });

  it("série vide : fill complet", () => {
    const plan = planChartDensify([], 0);
    expect(plan.mode).toBe("fill");
    if (plan.mode === "fill") {
      expect(plan.fetchAnnual).toBe(true);
      expect(plan.fetchRich).toBe(true);
    }
  });
});
