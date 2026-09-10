import { describe, expect, it } from "vitest";
import { adviseHolding, adviceRecap, horizonScoreFor } from "./portfolio-advice";
import type { TradeSignal, HorizonScores, SignalReason } from "./calc-metrics";

const scores = (court: number, moyen: number, long: number): HorizonScores => ({
  court,
  moyen,
  long,
});

const signal = (label: TradeSignal["label"]): TradeSignal => ({
  label,
  color: "#000",
});

describe("horizonScoreFor", () => {
  it("sélectionne le score selon l'horizon déclaré", () => {
    const h = scores(40, 60, 80);
    expect(horizonScoreFor("COURT", h)).toBe(40);
    expect(horizonScoreFor("MOYEN", h)).toBe(60);
    expect(horizonScoreFor("LONG", h)).toBe(80);
    expect(horizonScoreFor("MOYEN", null)).toBeNull();
  });
});

describe("adviseHolding", () => {
  it("propose Renforcer pour ACHAT avec score horizon favorable", () => {
    const reasons: SignalReason[] = [{ kind: "positif", text: "Bonne perf." }];
    const a = adviseHolding({
      buyHorizon: "MOYEN",
      signal: signal("ACHAT"),
      horizonScores: scores(50, 70, 65),
      signalReasons: reasons,
    });
    expect(a.action).toBe("RENFORCER");
    expect(a.label).toBe("Renforcer");
    expect(a.horizonScore).toBe(70);
    expect(a.reasons[0]).toBe("Bonne perf.");
  });

  it("propose Sortir pour VENDRE / ALLÉGER", () => {
    expect(
      adviseHolding({
        buyHorizon: "LONG",
        signal: signal("VENDRE"),
        horizonScores: scores(80, 80, 80),
      }).action
    ).toBe("SORTIR");
    expect(
      adviseHolding({
        buyHorizon: "COURT",
        signal: signal("ALLÉGER"),
        horizonScores: scores(80, 80, 80),
      }).action
    ).toBe("SORTIR");
  });

  it("atténue Renforcer si le score d'horizon est très faible", () => {
    const a = adviseHolding({
      buyHorizon: "COURT",
      signal: signal("ACHAT FORT"),
      horizonScores: scores(30, 60, 70),
    });
    expect(a.action).toBe("CONSERVER");
  });

  it("propose Conserver pour signal mitigé et score moyen", () => {
    const a = adviseHolding({
      buyHorizon: "MOYEN",
      signal: signal("CONSERVER"),
      horizonScores: scores(50, 55, 50),
    });
    expect(a.action).toBe("CONSERVER");
  });
});

describe("adviceRecap", () => {
  it("compte les actions par catégorie", () => {
    const list = [
      adviseHolding({ buyHorizon: "MOYEN", signal: signal("ACHAT"), horizonScores: scores(70, 70, 70) }),
      adviseHolding({ buyHorizon: "MOYEN", signal: signal("CONSERVER"), horizonScores: scores(50, 50, 50) }),
      adviseHolding({ buyHorizon: "MOYEN", signal: signal("VENDRE"), horizonScores: scores(20, 20, 20) }),
    ];
    expect(adviceRecap(list)).toEqual({ reinforce: 1, hold: 1, exit: 1 });
  });
});
