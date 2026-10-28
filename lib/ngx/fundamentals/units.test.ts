import { describe, expect, it } from "vitest";
import { detectUnit } from "./units";

describe("detectUnit", () => {
  it("reads ₦'000", () => {
    const u = detectUnit("Statement of financial position   ₦'000   ₦'000");
    expect(u.currency).toBe("NGN");
    expect(u.multiplier).toBe(1000);
  });
  it("reads N 'million", () => {
    expect(detectUnit("GROUP   N 'million  N 'million").multiplier).toBe(1e6);
  });
  it("reads 'In thousands of Nigerian Naira'", () => {
    const u = detectUnit("In thousands of Nigerian Naira   Dec-2022");
    expect(u.multiplier).toBe(1000);
    expect(u.currency).toBe("NGN");
  });
  it("flags USD reporters", () => {
    const u = detectUnit("Consolidated statement of comprehensive income   US$ millions");
    expect(u.currency).toBe("USD");
    expect(u.multiplier).toBe(1e6);
  });
  it("returns null multiplier when no unit is present", () => {
    expect(detectUnit("Statement of profit or loss").multiplier).toBeNull();
  });
});
