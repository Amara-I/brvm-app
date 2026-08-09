import { describe, expect, it } from "vitest";
import { computePortfolioMetrics } from "./portfolio-metrics";

describe("computePortfolioMetrics", () => {
  it("calcule la valeur totale, la plus-value et la répartition sectorielle", () => {
    const result = computePortfolioMetrics([
      { ticker: "SNTS", sector: "Télécoms", quantity: 10, avgBuyPrice: 20000, currentPrice: 28450, yearStartPrice: 28000 },
      { ticker: "CBIBF", sector: "Banques", quantity: 5, avgBuyPrice: 15000, currentPrice: 21465, yearStartPrice: 21000 },
    ]);

    expect(result.totalCostBasis).toBe(10 * 20000 + 5 * 15000);
    expect(result.totalMarketValue).toBe(10 * 28450 + 5 * 21465);
    expect(result.totalGainLoss).toBe(result.totalMarketValue - result.totalCostBasis);
    expect(result.totalGainLossPercent).toBeCloseTo((result.totalGainLoss / result.totalCostBasis) * 100, 2);

    // Répartition sectorielle : SNTS pèse plus lourd que CBIBF ici.
    expect(result.sectorBreakdown[0].sector).toBe("Télécoms");
    expect(result.sectorBreakdown.reduce((sum, s) => sum + s.weightPercent, 0)).toBeCloseTo(100, 0);
  });

  it("calcule la performance YTD à partir des cours de début d'année", () => {
    const result = computePortfolioMetrics([{ ticker: "SNTS", sector: "Télécoms", quantity: 10, avgBuyPrice: 20000, currentPrice: 28450, yearStartPrice: 28000 }]);
    const expectedYtd = ((28450 - 28000) / 28000) * 100;
    expect(result.ytdChangePercent).toBeCloseTo(expectedYtd, 2);
  });

  it("retourne 'N/D' pour les positions sans cours canonique disponible, sans faire échouer le calcul global", () => {
    const result = computePortfolioMetrics([
      { ticker: "SNTS", sector: "Télécoms", quantity: 10, avgBuyPrice: 20000, currentPrice: 28450, yearStartPrice: 28000 },
      { ticker: "NOUVEAU", sector: "Industrie", quantity: 3, avgBuyPrice: 5000, currentPrice: null, yearStartPrice: null },
    ]);

    expect(result.unresolvedTickers).toEqual(["NOUVEAU"]);
    const nouveauMetrics = result.holdings.find((h) => h.ticker === "NOUVEAU")!;
    expect(nouveauMetrics.currentPrice).toBe("N/D");
    expect(nouveauMetrics.marketValue).toBe("N/D");
    // La valeur totale ne prend en compte que les positions résolues.
    expect(result.totalMarketValue).toBe(10 * 28450);
    // Le coût d'acquisition, lui, reste comptabilisé même sans cours actuel.
    expect(result.totalCostBasis).toBe(10 * 20000 + 3 * 5000);
  });

  it("retourne 'N/D' pour le YTD si au moins un cours de début d'année est manquant", () => {
    const result = computePortfolioMetrics([
      { ticker: "SNTS", sector: "Télécoms", quantity: 10, avgBuyPrice: 20000, currentPrice: 28450, yearStartPrice: 28000 },
      { ticker: "ORAC", sector: "Télécoms", quantity: 4, avgBuyPrice: 15000, currentPrice: 15700, yearStartPrice: null },
    ]);
    expect(result.ytdChangePercent).toBe("N/D");
  });

  it("retourne un portefeuille vide sans erreur", () => {
    const result = computePortfolioMetrics([]);
    expect(result.totalMarketValue).toBe(0);
    expect(result.totalCostBasis).toBe(0);
    expect(result.totalGainLossPercent).toBe("N/D");
    expect(result.ytdChangePercent).toBe("N/D");
    expect(result.sectorBreakdown).toEqual([]);
  });
});
