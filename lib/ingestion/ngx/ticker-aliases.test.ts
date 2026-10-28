import { describe, expect, it } from "vitest";
import { applyNgxTickerAliases, NGX_TICKER_ALIASES, resolveNgxTicker } from "./ticker-aliases";

const known = new Set(["FIRSTHOLDCO", "HBMNG", "ACCESSCORP", "GTCO", "FBNH_TEST"]);

describe("alias de tickers NGX", () => {
  it("résout un ancien code vers le ticker courant", () => {
    expect(resolveNgxTicker("FBNH", known)).toBe("FIRSTHOLDCO");
    expect(resolveNgxTicker("wapco", known)).toBe("HBMNG");
    expect(resolveNgxTicker("ACCESS", known)).toBe("ACCESSCORP");
  });

  it("garde un code déjà connu et refuse un code inconnu", () => {
    expect(resolveNgxTicker("GTCO", known)).toBe("GTCO");
    expect(resolveNgxTicker("GHOST", known)).toBeNull();
  });

  it("n'applique pas l'alias si le ticker courant n'est pas en base", () => {
    expect(resolveNgxTicker("STERLNBANK", known)).toBeNull();
  });

  it("l'ancien code est ignoré s'il est lui-même un ticker en base", () => {
    expect(resolveNgxTicker("FBNH", new Set(["FBNH", "FIRSTHOLDCO"]))).toBe("FBNH");
  });

  it("réécrit les cours et compte inconnus / rattachés", () => {
    const out = applyNgxTickerAliases(
      [{ symbol: "FBNH", close: 1 }, { symbol: "GTCO", close: 2 }, { symbol: "GHOST", close: 3 }],
      known
    );
    expect(out.quotes.map((q) => q.symbol).sort()).toEqual(["FIRSTHOLDCO", "GTCO"]);
    expect(out.remapped).toBe(1);
    expect(out.unknown).toBe(1);
  });

  it("une séance portant l'ancien ET le nouveau code garde le code natif", () => {
    const out = applyNgxTickerAliases([{ symbol: "FBNH", close: 1 }, { symbol: "FIRSTHOLDCO", close: 2 }], known);
    expect(out.quotes).toEqual([{ symbol: "FIRSTHOLDCO", close: 2 }]);
    expect(out.remapped).toBe(0);
  });

  it("la table n'a ni doublon d'ancien code ni alias vers lui-même", () => {
    const olds = NGX_TICKER_ALIASES.map((a) => a.old);
    expect(new Set(olds).size).toBe(olds.length);
    expect(NGX_TICKER_ALIASES.every((a) => a.old !== a.current)).toBe(true);
  });
});
