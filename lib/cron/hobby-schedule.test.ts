import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAtMostDailyCron } from "./hobby-schedule";

describe("isAtMostDailyCron", () => {
  it("accepte un horaire fixe, y compris un jour de semaine", () => {
    expect(isAtMostDailyCron("0 17 * * *")).toBe(true);
    expect(isAtMostDailyCron("0 6 * * 1")).toBe(true);
    expect(isAtMostDailyCron("15 5 * * *")).toBe(true);
  });

  it("refuse les expressions qui partent plus d'une fois par jour", () => {
    expect(isAtMostDailyCron("5,25,45 * * * *")).toBe(false);
    expect(isAtMostDailyCron("15,35,55 * * * *")).toBe(false);
    expect(isAtMostDailyCron("10 * * * *")).toBe(false);
    expect(isAtMostDailyCron("40 * * * *")).toBe(false);
    expect(isAtMostDailyCron("0 5,17 * * *")).toBe(false);
    expect(isAtMostDailyCron("*/10 17 * * *")).toBe(false);
    expect(isAtMostDailyCron("0 */2 * * *")).toBe(false);
    expect(isAtMostDailyCron("* 17 * * *")).toBe(false);
  });
});

describe("vercel.json — plan Hobby", () => {
  const vercel = JSON.parse(readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };

  it("garde exactement deux crons, chacun au plus quotidien", () => {
    expect(vercel.crons).toHaveLength(2);
    for (const cron of vercel.crons) expect(isAtMostDailyCron(cron.schedule)).toBe(true);
    expect(vercel.crons.map((cron) => `${cron.schedule} ${cron.path}`).sort()).toEqual([
      "0 17 * * * /api/cron/ingest",
      "0 6 * * 1 /api/cron/research",
    ]);
  });
});
