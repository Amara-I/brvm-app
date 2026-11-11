import { describe, expect, it } from "vitest";
import { NGX_LOGO_TICKERS, ngxLogoSrc } from "./logo-manifest";
import { tickerMonogram } from "@/components/ui/CompanyMark";

describe("ngxLogoSrc", () => {
  it("renvoie le chemin local pour un ticker connu, insensible à la casse", () => {
    const sample = [...NGX_LOGO_TICKERS][0];
    if (!sample) return;
    expect(ngxLogoSrc(sample)).toBe(`/logos/ngx/${sample}.webp`);
    expect(ngxLogoSrc(sample.toLowerCase())).toBe(`/logos/ngx/${sample}.webp`);
  });

  it("renvoie null sans ticker ou si le logo est absent", () => {
    expect(ngxLogoSrc(null)).toBeNull();
    expect(ngxLogoSrc("")).toBeNull();
    expect(ngxLogoSrc("__NO_SUCH_TICKER__")).toBeNull();
  });
});

describe("tickerMonogram", () => {
  it("prend les deux premiers caractères du ticker", () => {
    expect(tickerMonogram("MTNN")).toBe("MT");
    expect(tickerMonogram("dangcem")).toBe("DA");
    expect(tickerMonogram("  GTCO  ")).toBe("GT");
  });
});
