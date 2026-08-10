// ═══════════════════════════════════════════════════════════════════════════
// Tests — calcMetrics (métriques brutes + analyse optimisée étape 14)
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import { calcMetrics } from "./calc-metrics";
import { COMPANIES_FULL, YEARS, LEGACY_COMPANY_TICKERS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];
const LEGACY_SET = new Set<string>(LEGACY_COMPANY_TICKERS);

describe("calcMetrics — parité des métriques brutes avec le JSX d'origine", () => {
  // Étape 14 : le SCORE / SIGNAL / RISQUE ont été recalibrés (demande
  // explicite d'optimisation). On conserve la non-régression UNIQUEMENT
  // sur les métriques brutes affichées (perf, dividende, volatilité, cours).
  const companiesWithGolden = COMPANIES_FULL.filter((c) => LEGACY_SET.has(c.ticker));

  it("couvre toujours les 20 sociétés d'origine du JSX", () => {
    expect(companiesWithGolden).toHaveLength(LEGACY_COMPANY_TICKERS.length);
  });

  for (const company of companiesWithGolden) {
    const expected = golden.find((g) => g.ticker === company.ticker)!;

    it(`produit les mêmes métriques brutes que le JSX pour ${company.ticker}`, () => {
      const result = calcMetrics({
        years: YEARS_ARRAY,
        prices: company.prices,
        dividends: company.dividends,
        per: company.per,
      });

      expect(result.perf5Percent).toBe(expected.metrics.perf5);
      expect(result.perf10Percent).toBe(expected.metrics.perf10);
      expect(String(result.avgDividend)).toBe(String(expected.metrics.avgDiv));
      expect(String(result.dividendYieldPercent)).toBe(String(expected.metrics.yield_));
      expect(result.volatilityPercent).toBe(expected.metrics.volat);
      expect(result.currentPrice).toBe(expected.metrics.currentPrice);
      expect(result.currentDividend).toBe(expected.metrics.currentDiv);
    });
  }
});

describe("calcMetrics — analyse optimisée (signal + explication)", () => {
  it("ne traite plus la volatilité N/D comme un risque Élevé", () => {
    const result = calcMetrics({
      years: YEARS_ARRAY,
      prices: { 2026: 5000 },
      dividends: { 2025: 200 },
      per: 10,
    });
    expect(result.volatilityPercent).toBe("N/D");
    expect(result.riskLevel).toBe("N/D");
    expect(result.confidence).toBe("Faible");
    expect(result.signalSummary).toMatch(/Signal final/);
    expect(result.signalReasons.length).toBeGreaterThan(0);
  });

  it("produit un signal parmi les 5 libellés non négociables", () => {
    const labels = new Set(["ACHAT FORT", "ACHAT", "CONSERVER", "ALLÉGER", "VENDRE"]);
    for (const company of COMPANIES_FULL) {
      const result = calcMetrics({
        years: YEARS_ARRAY,
        prices: company.prices,
        dividends: company.dividends,
        per: company.per,
      });
      expect(labels.has(result.signal.label)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.signalSummary.length).toBeGreaterThan(10);
    }
  });

  it("récompense une société solide (historique long, bons fondamentaux) type SNTS", () => {
    const snts = COMPANIES_FULL.find((c) => c.ticker === "SNTS")!;
    const result = calcMetrics({
      years: YEARS_ARRAY,
      prices: snts.prices,
      dividends: snts.dividends,
      per: snts.per,
    });
    expect(result.confidence).toBe("Élevée");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["ACHAT FORT", "ACHAT", "CONSERVER"]).toContain(result.signal.label);
    expect(result.signalReasons.some((r) => r.kind === "positif")).toBe(true);
  });

  it("plafonne les signaux extrêmes quand la confiance est Faible", () => {
    const result = calcMetrics({
      years: YEARS_ARRAY,
      // Un seul point de cours + gros dividende + PER bas → sans plafonnement
      // pourrait pousser vers ACHAT FORT ; on exige au plus ACHAT.
      prices: { 2026: 1000 },
      dividends: { 2026: 80 },
      per: 5,
    });
    expect(result.confidence).toBe("Faible");
    expect(result.signal.label).not.toBe("ACHAT FORT");
    expect(result.signal.label).not.toBe("VENDRE");
  });

  it("pénalise un PER extrême sans inventer de performance", () => {
    const result = calcMetrics({
      years: YEARS_ARRAY,
      prices: { 2026: 2000 },
      dividends: {},
      per: 500,
    });
    expect(result.perf5Percent).toBe("N/D");
    expect(result.signalReasons.some((r) => /PER extrême/i.test(r.text))).toBe(true);
  });
});
