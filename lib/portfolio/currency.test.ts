import { describe, expect, it } from "vitest";
import { portfolioCurrencyOf, splitByCurrency } from "./currency";

describe("portfolioCurrencyOf", () => {
  it("NGN pour la NGX, XOF par défaut", () => {
    expect(portfolioCurrencyOf({ exchange: "NGX", currency: "NGN" })).toBe("NGN");
    expect(portfolioCurrencyOf({ exchange: "NGX" })).toBe("NGN");
    expect(portfolioCurrencyOf({ currency: "NGN" })).toBe("NGN");
    expect(portfolioCurrencyOf({ exchange: "BRVM", currency: "XOF" })).toBe("XOF");
    expect(portfolioCurrencyOf({})).toBe("XOF");
  });
});

describe("splitByCurrency", () => {
  it("répartit sans mélanger les devises", () => {
    const rows = [
      { t: "SNTS", c: "XOF" as const },
      { t: "MTNN", c: "NGN" as const },
      { t: "ORAC", c: "XOF" as const },
    ];
    const out = splitByCurrency(rows, (r) => r.c);
    expect(out.XOF.map((r) => r.t)).toEqual(["SNTS", "ORAC"]);
    expect(out.NGN.map((r) => r.t)).toEqual(["MTNN"]);
  });
});
