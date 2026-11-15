import { describe, expect, it, vi } from "vitest";
import { cachedLoader, revalidateNgxMarketCache } from "./market-cache";

describe("cachedLoader hors runtime Next.js", () => {
  it("appelle directement la fonction (scripts, tests)", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const load = cachedLoader(fn, ["test-key"], { revalidate: 60, tags: ["t"] });
    await expect(load(21)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledWith(21);
  });

  it("propage les erreurs de la fonction", async () => {
    const load = cachedLoader(async () => {
      throw new Error("base injoignable");
    }, ["test-key-2"], { revalidate: 60, tags: ["t"] });
    await expect(load()).rejects.toThrow("base injoignable");
  });

  it("revalidateNgxMarketCache est sans effet hors requête", () => {
    expect(() => revalidateNgxMarketCache()).not.toThrow();
  });
});
