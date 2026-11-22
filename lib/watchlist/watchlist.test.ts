import { describe, expect, it } from "vitest";
import { WATCHLIST_MAX_ITEMS, watchlistIsFull, watchlistTickerSchema } from "./watchlist";

describe("watchlistTickerSchema", () => {
  it("normalise en majuscules et retire les espaces", () => {
    expect(watchlistTickerSchema.parse({ ticker: "  snts " }).ticker).toBe("SNTS");
  });
  it("accepte les tickers avec point ou tiret", () => {
    expect(watchlistTickerSchema.parse({ ticker: "ABC-1.x" }).ticker).toBe("ABC-1.X");
  });
  it("rejette vide, trop long et caractères spéciaux", () => {
    expect(watchlistTickerSchema.safeParse({ ticker: "" }).success).toBe(false);
    expect(watchlistTickerSchema.safeParse({ ticker: "A".repeat(13) }).success).toBe(false);
    expect(watchlistTickerSchema.safeParse({ ticker: "SN TS" }).success).toBe(false);
    expect(watchlistTickerSchema.safeParse({ ticker: "<script>" }).success).toBe(false);
  });
});

describe("watchlistIsFull", () => {
  it("refuse à partir du plafond", () => {
    expect(watchlistIsFull(WATCHLIST_MAX_ITEMS - 1)).toBe(false);
    expect(watchlistIsFull(WATCHLIST_MAX_ITEMS)).toBe(true);
  });
});
