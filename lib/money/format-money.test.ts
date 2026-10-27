import { describe, expect, it } from "vitest";
import { formatMoney } from "./format-money";

function flat(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

describe("formatMoney", () => {
  it("affiche le naira avec le symbole ₦", () => {
    expect(flat(formatMoney(1439.9, "NGN", "fr"))).toBe("₦1 439,90");
    expect(formatMoney(6.8, "NGN", "en")).toBe("₦6.80");
  });

  it("affiche le franc CFA en entier, comme le tableau BRVM", () => {
    expect(flat(formatMoney(1000, "XOF", "fr"))).toBe("1 000 FCFA");
    expect(flat(formatMoney(1000, "FCFA", "en"))).toBe("1,000 FCFA");
  });

  it("retourne N/D si la valeur n'est pas un nombre", () => {
    expect(formatMoney(Number.NaN, "NGN", "fr")).toBe("N/D");
  });
});
