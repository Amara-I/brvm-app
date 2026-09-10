import { describe, expect, it } from "vitest";
import { selectLatestPriceOnOrBefore } from "./latest-data";

describe("selectLatestPriceOnOrBefore", () => {
  it("ignore les proxies futurs (ex. 31/12) et garde le vrai cours du jour", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const picked = selectLatestPriceOnOrBefore(
      [
        { date: new Date("2026-08-10T00:00:00.000Z"), close: 32000 },
        { date: new Date("2026-12-31T00:00:00.000Z"), close: 28450 },
        { date: new Date("2026-08-20T00:00:00.000Z"), close: 31500 },
      ],
      now
    );
    expect(picked?.close).toBe(31500);
    expect(picked?.date.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  it("retourne null s'il n'y a que des dates futures", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const picked = selectLatestPriceOnOrBefore(
      [{ date: new Date("2026-12-31T00:00:00.000Z"), close: 1 }],
      now
    );
    expect(picked).toBeNull();
  });
});
