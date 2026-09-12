import { describe, expect, it } from "vitest";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "./is-database-unavailable";

describe("isDatabaseUnavailable", () => {
  it("détecte l'absence de DATABASE_URL", () => {
    expect(isDatabaseUnavailable(new Error("Environment variable not found: DATABASE_URL"))).toBe(true);
  });

  it("détecte un Postgres injoignable", () => {
    expect(isDatabaseUnavailable(new Error("Can't reach database server at localhost:5432"))).toBe(true);
  });

  it("ne masque pas un bug de requête", () => {
    expect(isDatabaseUnavailable(new Error("column price_history.foo does not exist"))).toBe(false);
  });
});

describe("isMissingDatabaseObject", () => {
  it("détecte une table pas encore migrée", () => {
    expect(
      isMissingDatabaseObject(new Error("The table `public.market_index_constituents` does not exist in the current database."))
    ).toBe(true);
    expect(isMissingDatabaseObject(new Error("P2021"))).toBe(true);
  });
});
