import { describe, expect, it } from "vitest";
import type { ReconciledPrice } from "./reconciliation";
import type { RawPriceQuote } from "./types";
import {
  chunksNeedingFetch,
  coveredDailyDates,
  earliestYearFromQuotes,
  iterateDailyChunks,
  mergeExistingPrices,
  quotesEligibleForCanonical,
  quotesNeedingUpsert,
} from "./history-coverage";

function quote(overrides: Partial<RawPriceQuote>): RawPriceQuote {
  return {
    ticker: "SNTS",
    closePrice: 100,
    volume: null,
    source: "SIKAFINANCE",
    date: "2024-01-15",
    fetchedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("iterateDailyChunks", () => {
  it("découpe une plage en fenêtres de 89 jours inclusives, sans trou", () => {
    const chunks = iterateDailyChunks("2024-01-01", "2024-07-01", 89);
    expect(chunks[0]).toEqual({ from: "2024-01-01", to: "2024-03-30" });
    expect(chunks.at(-1)?.to).toBe("2024-07-01");
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = new Date(`${chunks[i - 1]!.to}T00:00:00.000Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
      expect(chunks[i]!.from).toBe(prevEnd.toISOString().slice(0, 10));
    }
  });

  it("retourne [] si la plage est invalide", () => {
    expect(iterateDailyChunks("2024-06-01", "2024-01-01")).toEqual([]);
    expect(iterateDailyChunks("nope", "2024-01-01")).toEqual([]);
  });
});

describe("chunksNeedingFetch", () => {
  it("ignore un chunk déjà densifié (BRVM/Sika)", () => {
    const chunks = iterateDailyChunks("2024-01-01", "2024-03-30", 89);
    const dates = new Set<string>();
    for (let d = 1; d <= 40; d++) {
      dates.add(`2024-01-${String(d).padStart(2, "0")}`);
    }
    expect(chunksNeedingFetch(chunks, dates, 35)).toEqual([]);
  });

  it("refetch si seulement un point annuel au 31/12", () => {
    const chunks = [{ from: "2015-10-04", to: "2015-12-31" }];
    const dates = new Set(["2015-12-31"]);
    expect(chunksNeedingFetch(chunks, dates, 35)).toEqual(chunks);
  });

  it("adapte le seuil aux fenêtres courtes (dernier chunk < 89 j)", () => {
    const chunks = [{ from: "2026-08-30", to: "2026-09-11" }];
    const dates = new Set([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(chunksNeedingFetch(chunks, dates, 35)).toEqual([]);
  });
});

describe("quotesNeedingUpsert / canonical", () => {
  it("saute un upsert Sika identique déjà en base", () => {
    const incoming = [quote({ closePrice: 39005, date: "2026-09-10" })];
    const existing = [
      { date: "2026-09-10", source: "SIKAFINANCE" as const, closePrice: 39005 },
    ];
    expect(quotesNeedingUpsert(incoming, existing)).toEqual([]);
  });

  it("upsert si le cours Sika a changé", () => {
    const incoming = [quote({ closePrice: 39100, date: "2026-09-10" })];
    const existing = [
      { date: "2026-09-10", source: "SIKAFINANCE" as const, closePrice: 39005 },
    ];
    expect(quotesNeedingUpsert(incoming, existing)).toHaveLength(1);
  });

  it("n'élève pas Sika au canonique si BRVM_OFFICIEL existe déjà à la date", () => {
    const reconciled: ReconciledPrice[] = [
      {
        ticker: "SNTS",
        date: "2026-09-10",
        closePrice: 39005,
        resolvedSource: "SIKAFINANCE",
        candidates: [],
      },
    ];
    const existing = [
      { date: "2026-09-10", source: "BRVM_OFFICIEL" as const, closePrice: 39000 },
    ];
    expect(quotesEligibleForCanonical(reconciled, existing)).toEqual([]);
  });

  it("autorise Sika canonique si aucune source supérieure à cette date", () => {
    const reconciled: ReconciledPrice[] = [
      {
        ticker: "SNTS",
        date: "2018-06-15",
        closePrice: 15000,
        resolvedSource: "SIKAFINANCE",
        candidates: [],
      },
    ];
    expect(quotesEligibleForCanonical(reconciled, [])).toHaveLength(1);
  });
});

describe("mergeExistingPrices / coveredDailyDates", () => {
  it("fusionne les nouveaux points et compte BRVM+Sika comme couverture journalière", () => {
    const prev = [{ date: "2024-01-02", source: "MANUEL" as const, closePrice: 1 }];
    const merged = mergeExistingPrices(prev, [quote({ date: "2024-01-03", closePrice: 2 })]);
    expect(merged).toHaveLength(2);
    const covered = coveredDailyDates(merged);
    expect(covered.has("2024-01-03")).toBe(true);
    expect(covered.has("2024-01-02")).toBe(false);
  });
});

describe("earliestYearFromQuotes", () => {
  it("dérive l'année de début réelle de la série (pas une date inventée)", () => {
    expect(
      earliestYearFromQuotes([
        quote({ date: "2011-12-31" }),
        quote({ date: "2006-09-18" }),
        quote({ date: "2020-12-31" }),
      ])
    ).toBe(2006);
    expect(earliestYearFromQuotes([])).toBeNull();
  });
});
