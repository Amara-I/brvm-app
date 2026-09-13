import { describe, expect, it } from "vitest";
import {
  HEADLINE_SIKA_FALLBACKS,
  MIN_CANONICAL_POINTS_TO_SKIP,
  mergeSikaIndexSymbols,
  shouldSkipIndexHistory,
} from "./run-index-enrichment";

describe("mergeSikaIndexSymbols", () => {
  it("ajoute Composite et BRVM 30 si A–Z est vide", () => {
    const merged = mergeSikaIndexSymbols([]);
    expect(merged.map((s) => s.code).sort()).toEqual(["BRVM_30", "BRVM_COMPOSITE"]);
    expect(merged.find((s) => s.code === "BRVM_COMPOSITE")?.sikaSymbol).toBe("BRVMC");
    expect(merged.find((s) => s.code === "BRVM_30")?.sikaSymbol).toBe("BRVM30");
  });

  it("ne duplique pas un slug déjà présent", () => {
    const merged = mergeSikaIndexSymbols([
      { code: "BRVM_COMPOSITE", sikaSymbol: "BRVMC", label: "BRVM COMPOSITE" },
      { code: "BRVM_INDUSTRIE", sikaSymbol: "BRVMIND", label: "BRVM Industrie" },
    ]);
    expect(merged.filter((s) => s.code === "BRVM_COMPOSITE")).toHaveLength(1);
    expect(merged.map((s) => s.code)).toContain("BRVM_30");
    expect(merged.map((s) => s.code)).toContain("BRVM_INDUSTRIE");
  });
});

describe("shouldSkipIndexHistory", () => {
  it("saute une série déjà dense sauf force", () => {
    expect(shouldSkipIndexHistory(MIN_CANONICAL_POINTS_TO_SKIP)).toBe(true);
    expect(shouldSkipIndexHistory(MIN_CANONICAL_POINTS_TO_SKIP, true)).toBe(false);
    expect(shouldSkipIndexHistory(1)).toBe(false);
  });
});

describe("HEADLINE_SIKA_FALLBACKS", () => {
  it("couvre les deux indices affichés en priorité", () => {
    expect(HEADLINE_SIKA_FALLBACKS.map((s) => s.code)).toEqual(["BRVM_COMPOSITE", "BRVM_30"]);
  });
});
