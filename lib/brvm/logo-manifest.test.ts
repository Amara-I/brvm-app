import { describe, expect, it } from "vitest";
import { BRVM_LOGO_TICKERS, brvmLogoSrc } from "./logo-manifest";
import { tickerMonogram } from "@/components/ui/CompanyMark";

describe("brvmLogoSrc", () => {
  it("renvoie le chemin local pour un ticker connu, insensible à la casse", () => {
    const sample = [...BRVM_LOGO_TICKERS][0];
    if (!sample) return;
    expect(brvmLogoSrc(sample)).toBe(`/logos/brvm/${sample}.webp`);
    expect(brvmLogoSrc(sample.toLowerCase())).toBe(`/logos/brvm/${sample}.webp`);
  });

  it("renvoie null sans ticker ou si le logo est absent", () => {
    expect(brvmLogoSrc(null)).toBeNull();
    expect(brvmLogoSrc("")).toBeNull();
    expect(brvmLogoSrc("__NO_SUCH_TICKER__")).toBeNull();
  });
});

describe("tickerMonogram", () => {
  it("prend les deux premiers caractères du ticker", () => {
    expect(tickerMonogram("SNTS")).toBe("SN");
    expect(tickerMonogram("orac")).toBe("OR");
    expect(tickerMonogram("  BOAB  ")).toBe("BO");
  });
});
