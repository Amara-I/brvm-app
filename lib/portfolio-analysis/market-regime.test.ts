import { describe, expect, it } from "vitest";
import { assessMarket, emptyMacroReadings, type IndexPoint } from "./market-regime";

function series(from: string, days: number, start: number, dailyGrowth: number): IndexPoint[] {
  const points: IndexPoint[] = [];
  const date = new Date(`${from}T00:00:00.000Z`);
  let value = start;
  for (let i = 0; i < days; i += 1) {
    points.push({ date: date.toISOString().slice(0, 10), value });
    value *= 1 + dailyGrowth;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return points;
}

describe("assessMarket", () => {
  it("lit un régime favorable : indice en hausse, volatilité contenue, largeur haute", () => {
    const market = assessMarket({
      market: "BRVM",
      series: [{ code: "BRVM_COMPOSITE", name: "BRVM Composite", points: series("2026-07-01", 120, 400, 0.001) }],
      breadthChanges: [1, 0.8, 1.2, 0.4, -0.2, 0.6, 0.9, 1.1],
      policyRate: null,
      inflation: null,
    });
    expect(market.direction).toBe("HAUSSE");
    expect(market.change3mPct).not.toBeNull();
    expect(market.realizedVolPct).not.toBeNull();
    expect(market.realizedVolPct as number).toBeLessThan(25);
    expect(market.breadthRatio).toBeGreaterThan(0.55);
    expect(market.regime).toBe("RISK_ON");
    expect(market.macroNote).toBe("incomplete");
  });

  it("passe en défavorable si l'indice baisse ou si les baisses dominent", () => {
    const falling = assessMarket({
      market: "NGX",
      series: [{ code: "NGX_ASI", name: "NGX ASI", points: series("2026-07-01", 120, 100_000, -0.002) }],
      breadthChanges: [0.2, 0.2, 0.2, 0.2, 0.2, -0.2, -0.2, -0.2],
      policyRate: null,
      inflation: null,
    });
    expect(falling.direction).toBe("BAISSE");
    expect(falling.regime).toBe("RISK_OFF");

    const narrow = assessMarket({
      market: "BRVM",
      series: [{ code: "BRVM_COMPOSITE", name: "BRVM Composite", points: series("2026-07-01", 120, 400, 0) }],
      breadthChanges: [1, -1, -1, -1, -0.5, -0.8, -0.4, -1.2],
      policyRate: null,
      inflation: null,
    });
    expect(narrow.direction).toBe("NEUTRE");
    expect(narrow.regime).toBe("RISK_OFF");
  });

  it("reste inconnu sans points ni largeur, et n'annualise pas une série annuelle", () => {
    const empty = assessMarket({
      market: "BRVM",
      series: [],
      breadthChanges: [null, null],
      policyRate: null,
      inflation: null,
    });
    expect(empty.regime).toBe("INCONNU");
    expect(empty.last).toBeNull();
    expect(empty.realizedVolPct).toBeNull();

    const yearly = assessMarket({
      market: "BRVM",
      series: [
        {
          code: "BRVM_COMPOSITE",
          name: "BRVM Composite",
          points: [
            { date: "2024-12-31", value: 250 },
            { date: "2025-12-31", value: 280 },
          ],
        },
      ],
      breadthChanges: [],
      policyRate: null,
      inflation: null,
    });
    expect(yearly.realizedVolPct).toBeNull();
    expect(yearly.change1mPct).toBeNull();
    expect(yearly.change3mPct).toBeNull();
  });

  it("laisse le régime inchangé si le taux ou l'inflation manque, et le tempère si le taux réel est très négatif", () => {
    const points = series("2026-07-01", 120, 400, 0.001);
    const unchanged = assessMarket({
      market: "BRVM",
      series: [{ code: "BRVM_COMPOSITE", name: "BRVM Composite", points }],
      breadthChanges: [1, 1, 1, 1, 1, 1],
      policyRate: 2,
      inflation: null,
    });
    expect(unchanged.regime).toBe("RISK_ON");
    expect(unchanged.macroNote).toBe("incomplete");

    const cooled = assessMarket({
      market: "NGX",
      series: [{ code: "NGX_ASI", name: "NGX ASI", points: series("2026-07-01", 120, 1000, 0.001) }],
      breadthChanges: [1, 1, 1, 1, 1, 1],
      policyRate: 2,
      inflation: 8,
    });
    expect(cooled.baseRegime).toBe("RISK_ON");
    expect(cooled.regime).toBe("NEUTRE");
    expect(cooled.macroNote).toBe("real_rate_negative");
  });

  it("prévoit les cases macro vides", () => {
    const ids = emptyMacroReadings().map((reading) => reading.id);
    expect(ids).toEqual([
      "bceao_policy_rate",
      "uemoa_inflation",
      "cbn_policy_rate",
      "nigeria_inflation",
      "xof_per_ngn",
    ]);
    expect(emptyMacroReadings().every((reading) => reading.value === null)).toBe(true);
  });
});
