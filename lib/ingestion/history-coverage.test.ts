import { describe, expect, it } from "vitest";
import type { ReconciledPrice } from "./reconciliation";
import type { RawPriceQuote } from "./types";
import {
  FORCE_DAILY_EMPTY_WINDOW_MIN_POINTS,
  chunksNeedingFetch,
  coveredDailyDates,
  earliestYearFromQuotes,
  iterateDailyChunks,
  maxDailyChunksThisRun,
  mergeExistingPrices,
  minIsoDate,
  planDailyBackfill,
  quotesEligibleForCanonical,
  quotesNeedingUpsert,
  resolveDailyFromIso,
} from "./history-coverage";
import type { ExistingPriceRef } from "./history-coverage";

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

function annualLikeExisting(fromYear: number, toYear: number): ExistingPriceRef[] {
  const out: ExistingPriceRef[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ date: `${y}-12-31`, source: "SIKAFINANCE", closePrice: 1000 + y });
  }
  return out;
}

describe("resolveDailyFromIso / planDailyBackfill", () => {
  it("garde le plus tôt entre annuel Sika (2006) et mensuel plus court (~2021)", () => {
    const existing = annualLikeExisting(2006, 2026);
    // Mensuel GetHistos ne renvoie souvent que ~60 derniers mois.
    const fromIso = resolveDailyFromIso({
      dailyFromOpt: "auto",
      firstSikaIso: "2021-08-01",
      existing,
      listedSinceIso: null,
      annualFromYear: 1998,
    });
    expect(fromIso).toBe("2006-12-31");
  });

  it("n'applique pas listedSince s'il existe déjà des cours avant cette date", () => {
    const existing = annualLikeExisting(2006, 2026);
    const fromIso = resolveDailyFromIso({
      dailyFromOpt: "auto",
      firstSikaIso: "2006-12-31",
      existing,
      listedSinceIso: "2025-04-28",
      annualFromYear: 1998,
    });
    expect(fromIso).toBe("2006-12-31");
  });

  it("applique listedSince seulement sans aucun cours antérieur (IPO récente)", () => {
    const existing: ExistingPriceRef[] = [
      { date: "2025-06-01", source: "SIKAFINANCE", closePrice: 10 },
    ];
    const fromIso = resolveDailyFromIso({
      dailyFromOpt: "auto",
      firstSikaIso: "1998-01-01",
      existing,
      listedSinceIso: "2025-04-28",
      annualFromYear: 1998,
    });
    expect(fromIso).toBe("2025-04-28");
  });

  it("cas BICC : série mensuelle 2006–2026 → ~77 fenêtres à densifier, même si le flag daily est off", () => {
    const existing: ExistingPriceRef[] = [];
    for (let y = 2006; y <= 2020; y++) {
      existing.push({ date: `${y}-12-31`, source: "SIKAFINANCE", closePrice: 1 });
    }
    // ~1 point / mois 2023–2026 (pas assez pour 35 / 89 j)
    for (let y = 2021; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2026 && m > 9) break;
        existing.push({
          date: `${y}-${String(m).padStart(2, "0")}-01`,
          source: "SIKAFINANCE",
          closePrice: 1,
        });
      }
    }
    const plan = planDailyBackfill({
      flagDaily: false,
      forceDaily: false,
      dailyFromOpt: "auto",
      firstSikaIso: "2006-12-31",
      existing,
      listedSinceIso: null,
      todayIso: "2026-09-11",
    });
    expect(plan.includeDaily).toBe(false);
    expect(plan.skipReason).toBe("flag_daily_disabled");
    expect(plan.fromIso).toBe("2006-12-31");
    expect(plan.gaps.length).toBeGreaterThan(50);
    expect(plan.existingPoints).toBe(existing.length);
  });

  it("forceDaily=1 ignore le flag et planifie les mêmes gaps BICC", () => {
    const existing = annualLikeExisting(2006, 2026);
    const plan = planDailyBackfill({
      flagDaily: false,
      forceDaily: true,
      dailyFromOpt: "auto",
      firstSikaIso: "2006-12-31",
      existing,
      listedSinceIso: null,
      todayIso: "2026-09-11",
    });
    expect(plan.includeDaily).toBe(true);
    expect(plan.skipReason).toBeNull();
    expect(plan.gaps.length).toBeGreaterThan(50);
    expect(plan.flagDaily).toBe(false);
    expect(plan.forceDaily).toBe(true);
  });

  it("minDailyPoints=1 ne refetch que les fenêtres vides (années mensuelles sautées)", () => {
    const existing: ExistingPriceRef[] = [];
    for (let m = 1; m <= 9; m++) {
      existing.push({
        date: `2026-${String(m).padStart(2, "0")}-01`,
        source: "SIKAFINANCE",
        closePrice: 1,
      });
    }
    const aggressive = planDailyBackfill({
      flagDaily: true,
      firstSikaIso: "2026-01-01",
      existing,
      todayIso: "2026-09-11",
      minDailyPoints: 35,
    });
    const emptyOnly = planDailyBackfill({
      flagDaily: true,
      firstSikaIso: "2026-01-01",
      existing,
      todayIso: "2026-09-11",
      minDailyPoints: FORCE_DAILY_EMPTY_WINDOW_MIN_POINTS,
    });
    expect(aggressive.gaps.length).toBeGreaterThan(emptyOnly.gaps.length);
  });
});

describe("maxDailyChunksThisRun", () => {
  it("plafonne à 8 fenêtres sur un cron Hobby avec budget restant", () => {
    expect(maxDailyChunksThisRun({ timeLeftMs: 200_000 })).toBe(8);
  });

  it("autorise 1 fenêtre s'il reste ≥ 20 s même sous la réserve fiches", () => {
    expect(maxDailyChunksThisRun({ timeLeftMs: 22_000 })).toBe(1);
  });

  it("n'impose pas de plafond temps au CLI (Infinity)", () => {
    expect(maxDailyChunksThisRun({ timeLeftMs: Number.POSITIVE_INFINITY })).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it("respecte maxDailyChunks explicite (forceDaily ops)", () => {
    expect(maxDailyChunksThisRun({ timeLeftMs: 200_000, maxDailyChunks: 2 })).toBe(2);
  });
});

describe("minIsoDate", () => {
  it("ignore les null et garde la plus ancienne ISO", () => {
    expect(minIsoDate(null, "2021-08-01", "2006-12-31", undefined)).toBe("2006-12-31");
    expect(minIsoDate(null, undefined)).toBeNull();
  });
});
