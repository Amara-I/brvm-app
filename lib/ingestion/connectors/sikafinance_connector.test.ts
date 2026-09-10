import { describe, expect, it } from "vitest";
import { annualPointStorageDate } from "./sikafinance_connector";

describe("annualPointStorageDate", () => {
  it("normalise les années passées au 31/12", () => {
    expect(annualPointStorageDate("02/01/2015", new Date("2026-08-12T00:00:00Z"))).toBe("2015-12-31");
  });

  it("ancre l'année courante à asOf (évite le pic au 01/01 Sika)", () => {
    expect(annualPointStorageDate("01/01/2026", new Date("2026-08-21T00:00:00Z"))).toBe("2026-08-21");
    expect(annualPointStorageDate("12/08/2026", new Date("2026-08-12T00:00:00Z"))).toBe("2026-08-12");
  });
});
