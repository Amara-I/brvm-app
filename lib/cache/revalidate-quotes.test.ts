import { describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));

import { quoteRevalidationTags, revalidateQuotesAfterWrite } from "./revalidate-quotes";

describe("revalidateQuotesAfterWrite", () => {
  it("BRVM : derniers cours, place, titres et jeu marché", () => {
    expect(quoteRevalidationTags({ markets: ["BRVM"], tickers: ["snts"] }).sort()).toEqual(
      ["companies-full", "quote:SNTS", "quotes", "quotes:BRVM"].sort()
    );
  });
  it("NGX : cache NGX inclus", () => {
    expect(quoteRevalidationTags({ markets: ["NGX"] })).toEqual(["quotes", "quotes:NGX", "ngx-market"]);
  });
  it("invalide chaque étiquette, sans planter hors runtime Next.js", () => {
    revalidateTag.mockImplementationOnce(() => {
      throw new Error("Invariant: static generation store missing in revalidateTag quotes");
    });
    expect(() => revalidateQuotesAfterWrite({ markets: ["BRVM", "NGX"] })).not.toThrow();
    expect(revalidateTag).toHaveBeenCalledWith("quotes:NGX");
    expect(revalidateTag).toHaveBeenCalledWith("companies-full");
  });
});
