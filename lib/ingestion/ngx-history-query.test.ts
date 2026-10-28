import { describe, expect, it } from "vitest";
import {
  NGX_HISTORY_MAX_BUDGET_MS,
  clampNgxHistoryBudgetMs,
  parseLooseIsoDate,
  parseNgxHistorySearchParams,
} from "./ngx-history-query";

const NOW = new Date("2026-10-27T18:00:00.000Z");

describe("parseNgxHistorySearchParams", () => {
  it("plafond le budget Hobby à 240 s", () => {
    expect(clampNgxHistoryBudgetMs("999999")).toBe(NGX_HISTORY_MAX_BUDGET_MS);
    expect(clampNgxHistoryBudgetMs("240000")).toBe(240_000);
    expect(clampNgxHistoryBudgetMs("50000")).toBe(50_000);
    expect(clampNgxHistoryBudgetMs(null)).toBe(240_000);
    expect(clampNgxHistoryBudgetMs("0")).toBe(240_000);
    expect(parseNgxHistorySearchParams(new URLSearchParams("budgetMs=900000"), NOW).budgetMs).toBe(240_000);
  });

  it("accepte une séance JJ/MM et active charts + fx", () => {
    const parsed = parseNgxHistorySearchParams(new URLSearchParams("date=27/10"), NOW);
    expect(parsed.date).toBe("2026-10-27");
    expect(parsed.from).toBe("2026-10-27");
    expect(parsed.to).toBe("2026-10-27");
    expect(parsed.limit).toBe(1);
    expect(parsed.charts).toBe(true);
    expect(parsed.fx).toBe(true);
    expect(parsed.tryJson).toBe(true);
    expect(parseLooseIsoDate("27/10/2026")).toBe("2026-10-27");
    expect(parseLooseIsoDate("2026-10-27")).toBe("2026-10-27");
  });

  it("borne un chunk d'historique sans charts ni fx par défaut", () => {
    const parsed = parseNgxHistorySearchParams(
      new URLSearchParams("from=2021-10-27&to=2026-10-27&cursor=2024-03-01&limit=8"),
      NOW
    );
    expect(parsed.charts).toBe(false);
    expect(parsed.fx).toBe(false);
    expect(parsed.limit).toBe(8);
    expect(parsed.cursor).toBe("2024-03-01");
    expect(parsed.tryJson).toBe(false);
    expect(parsed.resume).toBe(true);
  });

  it("défaut 20 séances par appel, plafonné à 60", () => {
    expect(parseNgxHistorySearchParams(new URLSearchParams("from=2021-10-27"), NOW).limit).toBe(20);
    expect(parseNgxHistorySearchParams(new URLSearchParams("limit=500"), NOW).limit).toBe(60);
  });

  it("limit=0 ne télécharge pas de PDF et peut rafraîchir les séries", () => {
    const parsed = parseNgxHistorySearchParams(new URLSearchParams("limit=0&charts=1&fx=1&after=DANGCEM"), NOW);
    expect(parsed.limit).toBe(0);
    expect(parsed.charts).toBe(true);
    expect(parsed.fx).toBe(true);
    expect(parsed.chartsAfter).toBe("DANGCEM");
  });

  it("charts=0 sur une séance unique laisse le fx", () => {
    const parsed = parseNgxHistorySearchParams(new URLSearchParams("date=2026-10-27&charts=0"), NOW);
    expect(parsed.charts).toBe(false);
    expect(parsed.fx).toBe(true);
    expect(parsed.limit).toBe(1);
  });
});
