import { describe, expect, it } from "vitest";
import type { PriceBar } from "@/lib/analysis/technical-plan";
import { assessLiquidity, EXIT_DAYS, TURNOVER_ILLIQUID_FCFA } from "./liquidity";

function daily(count: number, volume: number | null, close = 1000): PriceBar[] {
  const start = new Date("2026-06-01T00:00:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), close, volume };
  });
}

const identity = (amount: number) => amount;

describe("assessLiquidity", () => {
  it("classe un titre échangé chaque jour comme liquide et borne la taille à 10 jours de volume", () => {
    const result = assessLiquidity(daily(20, 20_000), identity);
    expect(result.band).toBe("LIQUIDE");
    expect(result.noTradeRatio).toBe(0);
    expect(result.exitDays).toBe(EXIT_DAYS.LIQUIDE);
    expect(result.maxShares).toBe(200_000);
    expect(result.medianDailyTurnoverFcfa).toBe(20_000_000);
  });

  it("met en avant un titre souvent sans séance et réduit les jours de sortie", () => {
    const bars = daily(20, 8_000).map((bar, index) => (index % 2 === 0 ? { ...bar, volume: 0 } : bar));
    const result = assessLiquidity(bars, identity);
    expect(result.noTradeRatio).toBe(0.5);
    expect(result.band).toBe("ILLIQUIDE");
    expect(result.exitDays).toBe(EXIT_DAYS.ILLIQUIDE);
    expect(result.maxShares).toBe(16_000);
  });

  it("juge peu liquide un turnover médian sous le seuil, même sans jour blanc", () => {
    const close = 100;
    const volume = TURNOVER_ILLIQUID_FCFA / close - 1;
    const result = assessLiquidity(daily(12, volume, close), identity);
    expect(result.band).toBe("ILLIQUIDE");
    expect(result.medianDailyTurnoverFcfa).toBeLessThan(TURNOVER_ILLIQUID_FCFA);
  });

  it("ne fabrique pas de liquidité à partir d'une série annuelle", () => {
    const bars: PriceBar[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((year) => ({
      date: `${year}-12-31`,
      close: 1000 + year,
      volume: 1_000_000,
    }));
    const result = assessLiquidity(bars, identity);
    expect(result.band).toBe("INCONNUE");
    expect(result.maxShares).toBeNull();
    expect(result.noTradeRatio).toBeNull();
  });
});
