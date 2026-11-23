import { describe, expect, it } from "vitest";
import { civilDaysBetween, daysUntilExDate, exDateDelayLabel } from "./alerts";

const now = new Date("2026-11-23T10:00:00Z");

describe("civilDaysBetween", () => {
  it("compte les jours civils", () => {
    expect(civilDaysBetween("2026-11-23", "2026-11-30")).toBe(7);
    expect(civilDaysBetween("2026-11-23", "2026-11-22")).toBe(-1);
  });
  it("renvoie NaN si la date est invalide", () => {
    expect(Number.isNaN(civilDaysBetween("x", "2026-11-22"))).toBe(true);
  });
});

describe("daysUntilExDate", () => {
  it("détecte aujourd'hui, demain et la limite de 7 jours", () => {
    expect(daysUntilExDate(new Date("2026-11-23T00:00:00Z"), now)).toBe(0);
    expect(daysUntilExDate(new Date("2026-11-24T00:00:00Z"), now)).toBe(1);
    expect(daysUntilExDate(new Date("2026-11-30T00:00:00Z"), now)).toBe(7);
  });
  it("ignore le passé, le trop lointain et l'absence de date", () => {
    expect(daysUntilExDate(new Date("2026-11-22T00:00:00Z"), now)).toBeNull();
    expect(daysUntilExDate(new Date("2026-12-01T00:00:00Z"), now)).toBeNull();
    expect(daysUntilExDate(null, now)).toBeNull();
  });
});

describe("exDateDelayLabel", () => {
  it("formule le délai", () => {
    expect(exDateDelayLabel(0)).toBe("aujourd'hui");
    expect(exDateDelayLabel(1)).toBe("demain");
    expect(exDateDelayLabel(4)).toBe("dans 4 jours");
  });
});
