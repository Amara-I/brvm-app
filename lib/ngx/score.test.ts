import { describe, expect, it } from "vitest";
import { fixtureCompany, fixtureSeries, fixtureSheetInput } from "./__fixtures__";
import {
  MIN_COVERAGE,
  NGX_SCORE_WEIGHTS,
  UNCONFIRMED_FACTOR,
  computeNgxScore,
  lin,
  policyScore,
  scoreBand,
  weightedScore,
  type NgxPillar,
  type NgxPillarKey,
} from "./score";
import { buildNgxSheet } from "./sheet-model";

const build = (company = fixtureSheetInput().company, extra: Parameters<typeof buildNgxSheet>[0] extends infer T ? Partial<T> : never = {}) => {
  const input = fixtureSheetInput();
  return buildNgxSheet({ ...input, company, universe: [company, ...input.universe.filter((c) => c.ticker !== company.ticker)], ...extra });
};

describe("poids", () => {
  it("somment à 1 pour le global et chaque politique", () => {
    for (const w of Object.values(NGX_SCORE_WEIGHTS)) {
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    }
  });
  it("interpolation bornée", () => {
    expect(lin(-100, [[0, 10], [10, 50]])).toBe(10);
    expect(lin(5, [[0, 10], [10, 50]])).toBe(30);
    expect(lin(99, [[0, 10], [10, 50]])).toBe(50);
  });
  it("bandes", () => {
    expect(scoreBand(65)).toBe("HIGH");
    expect(scoreBand(50)).toBe("GOOD");
    expect(scoreBand(35)).toBe("MIXED");
    expect(scoreBand(10)).toBe("LOW");
    expect(scoreBand(null)).toBeNull();
  });
});

describe("weightedScore", () => {
  const p = (key: NgxPillarKey, score: number | null): NgxPillar => ({ key, score, reliability: 1, components: [] });
  const pillars = (o: Partial<Record<NgxPillarKey, number | null>>) =>
    Object.fromEntries(
      (["growth", "quality", "valuation", "dividends", "momentum", "risk"] as const).map((k) => [k, p(k, o[k] ?? null)]),
    ) as Record<NgxPillarKey, NgxPillar>;

  it("redistribue le poids des piliers manquants, sans les compter comme 0", () => {
    const r = weightedScore(pillars({ momentum: 80, risk: 60 }), NGX_SCORE_WEIGHTS.OVERALL);
    expect(r.score).toBe(Math.round((80 * 0.2 + 60 * 0.15) / 0.35));
    expect(r.coverage).toBeCloseTo(0.35, 6);
    expect(r.missing).toContain("growth");
  });
  it("N/D quand un pilier requis manque", () => {
    const r = weightedScore(pillars({ momentum: 80, risk: 60 }), NGX_SCORE_WEIGHTS.RENTE, ["dividends"]);
    expect(r.score).toBeNull();
  });
  it("N/D sous la couverture minimale", () => {
    const r = weightedScore(pillars({ risk: 60 }), NGX_SCORE_WEIGHTS.OVERALL);
    expect(r.coverage).toBeLessThan(MIN_COVERAGE);
    expect(r.score).toBeNull();
  });
});

describe("computeNgxScore", () => {
  const model = build();
  const score = model.score;

  it("est inclus dans la fiche et identique à un recalcul", () => {
    expect(computeNgxScore(model)).toEqual(score);
  });
  it("société complète : tous les piliers, mode FULL, notes bornées 0–100", () => {
    expect(score.mode).toBe("FULL");
    for (const pil of Object.values(score.pillars)) {
      expect(pil.score).not.toBeNull();
      expect(pil.score!).toBeGreaterThanOrEqual(0);
      expect(pil.score!).toBeLessThanOrEqual(100);
    }
    expect(score.policies.map((x) => x.type)).toEqual(["OVERALL", "CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"]);
    for (const pol of score.policies) expect(pol.score).not.toBeNull();
    expect(score.overall).toBe(policyScore(score, "OVERALL").score);
  });
  it("une forte croissance et un rendement élevé donnent de bons piliers", () => {
    expect(score.pillars.growth.score!).toBeGreaterThan(60);
    expect(score.pillars.dividends.score!).toBeGreaterThan(50);
  });
  it("le dernier exercice n'étant jamais « high », le pilier est ramené vers 50", () => {
    const g = score.pillars.growth;
    expect(g.reliability!).toBeLessThanOrEqual(1);
    expect(g.reliability!).toBeGreaterThanOrEqual(UNCONFIRMED_FACTOR);
  });
  it("sans comptes : technique seul, étiqueté, seule la politique Trading est notée", () => {
    const bare = fixtureCompany("SMALLCO", 5, { shares: null });
    const m = build(bare, { series: fixtureSeries(420, 100, 0.002, 5_000_000) });
    expect(m.score.mode).toBe("CHART_ONLY");
    expect(m.score.confidence).toBe("LOW");
    expect(m.score.confirmedShare).toBeNull();
    expect(m.score.overall).not.toBeNull();
    expect(policyScore(m.score, "TRADING").score).not.toBeNull();
    expect(policyScore(m.score, "RENTE").score).toBeNull();
    expect(policyScore(m.score, "CROISSANCE").score).toBeNull();
    expect(m.score.pillars.growth.score).toBeNull();
  });
  it("sans cours ni comptes : aucune note", () => {
    const bare = fixtureCompany("GHOST", null, { shares: null });
    const m = build(bare, { series: [] });
    expect(m.score.mode).toBe("NONE");
    expect(m.score.overall).toBeNull();
  });
  it("comptes de plus de 2 ans : fondamentaux exclus, technique conservé", () => {
    const old = fixtureCompany("OLDCO", 100, {
      netIncome: [10, 12, 14],
      revenue: [90, 100, 125],
      equity: 80,
      shares: 6e8,
      dps: [1, 1.5, 2],
    });
    // Décale tous les exercices de 5 ans en arrière.
    old.ratios = old.ratios.map((r) => ({ ...r, year: r.year - 5 }));
    old.dividends = old.dividends.map((d) => ({ ...d, year: d.year - 5 }));
    old.profileMeta = {
      ...(old.profileMeta as object),
      ngxFundamentals: {
        ...((old.profileMeta as { ngxFundamentals: object }).ngxFundamentals),
        years: { "2015": { equityBn: 80, equityConfidence: "high" } },
      },
    };
    const m = build(old);
    expect(m.score.staleAccountsYear).not.toBeNull();
    expect(m.score.mode).toBe("CHART_ONLY");
    expect(m.score.pillars.valuation.score).toBeNull();
    expect(m.score.pillars.momentum.score).not.toBeNull();
  });
  it("aucun dividende référencé : pilier N/D (pas 0) et Rente N/D", () => {
    const c = fixtureCompany("NODIV", 100, {
      netIncome: [10, 12, 15, 18, 20],
      revenue: [90, 100, 125, 140, 150],
      equity: 80,
      shares: 6e8,
      dps: [],
    });
    const m = build(c);
    expect(m.score.pillars.dividends.score).toBeNull();
    expect(policyScore(m.score, "RENTE").score).toBeNull();
    expect(policyScore(m.score, "CROISSANCE").score).not.toBeNull();
  });
  it("résultat net négatif : croissance et PER sanctionnés, pas écartés", () => {
    const c = fixtureCompany("LOSS", 100, {
      netIncome: [10, 6, 2, -3, -8],
      revenue: [90, 80, 70, 60, 50],
      equity: 80,
      shares: 6e8,
      dps: [],
    });
    const m = build(c);
    expect(m.score.pillars.growth.score!).toBeLessThan(35);
    expect(m.score.pillars.quality.score!).toBeLessThan(40);
  });
  it("confiance « low » : le critère est écarté", () => {
    const c = fixtureCompany("LOWCONF", 100, {
      netIncome: [10, 12, 15, 18, 20],
      revenue: [90, 100, 125, 140, 150],
      equityByYear: { 2024: 70, 2025: 80 },
      shares: 6e8,
      dps: [1, 1.2],
      epsByYear: { 2021: 1, 2025: 3 },
    });
    const meta = c.profileMeta as { ngxFundamentals: { years: Record<string, Record<string, unknown>> } };
    meta.ngxFundamentals.years["2025"].epsConfidence = "low";
    const m = build(c);
    expect(m.score.pillars.growth.components.find((x) => x.key === "revenueYoy")).toBeUndefined();
  });
});
