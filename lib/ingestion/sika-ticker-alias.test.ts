import { describe, expect, it } from "vitest";
import {
  applySikaSymbolAliases,
  internalTickerForSika,
  SIKA_SYMBOL_BY_TICKER,
} from "./sika-ticker-alias";

describe("alias Sikafinance BBGCI", () => {
  it("pointe le ticker base vers BBGC.ci", () => {
    expect(SIKA_SYMBOL_BY_TICKER.BBGCI).toBe("BBGC.ci");
  });

  it("ramène BBGC et BBGC.ci vers BBGCI", () => {
    expect(internalTickerForSika("BBGC")).toBe("BBGCI");
    expect(internalTickerForSika("bbgc.ci")).toBe("BBGCI");
    expect(internalTickerForSika("SNTS.sn")).toBe("SNTS");
  });

  it("n'écrase pas un symbole déjà présent pour un autre ticker", () => {
    const map = new Map([["SNTS", "SNTS.sn"]]);
    applySikaSymbolAliases(map);
    expect(map.get("SNTS")).toBe("SNTS.sn");
    expect(map.get("BBGCI")).toBe("BBGC.ci");
  });
});
