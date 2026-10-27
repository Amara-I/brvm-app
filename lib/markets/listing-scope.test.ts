import { describe, expect, it } from "vitest";
import { NGX_SESSION_COLLAR_PERCENT, BRVM_SESSION_COLLAR_PERCENT, collarConfigForExchange } from "@/lib/ingestion/price-collar";
import { SOURCE_PRIORITY } from "@/lib/ingestion/reconciliation";
import { currencyForExchange, listingKey, onExchange } from "./listing-scope";

describe("périmètre de place", () => {
  it("filtre BRVM par défaut", () => {
    expect(onExchange()).toEqual({ exchange: "BRVM" });
    expect(onExchange("NGX")).toEqual({ exchange: "NGX" });
  });

  it("distingue un même symbole selon la place", () => {
    expect(listingKey("BRVM", "snts")).toBe("BRVM:SNTS");
    expect(listingKey("NGX", "snts")).not.toBe(listingKey("BRVM", "snts"));
  });

  it("associe NGN à la NGX et XOF à la BRVM", () => {
    expect(currencyForExchange("NGX")).toBe("NGN");
    expect(currencyForExchange("BRVM")).toBe("XOF");
  });
});

describe("collier de séance selon la place", () => {
  it("garde ±7,5 % pour la BRVM et ±10 % pour la NGX", () => {
    expect(BRVM_SESSION_COLLAR_PERCENT).toBe(7.5);
    expect(NGX_SESSION_COLLAR_PERCENT).toBe(10);
    expect(collarConfigForExchange("BRVM").collarPercent).toBe(7.5);
    expect(collarConfigForExchange("NGX").collarPercent).toBe(10);
  });
});

describe("priorité des sources", () => {
  it("laisse BRVM_OFFICIEL devant NGX_OFFICIEL", () => {
    expect(SOURCE_PRIORITY[0]).toBe("BRVM_OFFICIEL");
    expect(SOURCE_PRIORITY.indexOf("NGX_OFFICIEL")).toBeGreaterThan(0);
    expect(SOURCE_PRIORITY.indexOf("NGX_OFFICIEL")).toBeLessThan(SOURCE_PRIORITY.indexOf("SIKAFINANCE"));
  });
});
