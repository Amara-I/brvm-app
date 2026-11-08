import { describe, expect, it } from "vitest";
import { isWeeklyProposalsDay, runWeeklyPortfolioProposals } from "./monday-hooks";

describe("runWeeklyPortfolioProposals", () => {
  it("reconnaît le lundi UTC", () => {
    expect(isWeeklyProposalsDay(new Date("2026-11-09T06:00:00Z"))).toBe(true);
    expect(isWeeklyProposalsDay(new Date("2026-11-08T17:00:00Z"))).toBe(false);
  });

  it("le lundi expose le hook sans rien envoyer", async () => {
    const result = await runWeeklyPortfolioProposals(new Date("2026-11-09T06:00:00Z"));
    expect(result.ran).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/non branché/);
  });

  it("un autre jour ne déclenche pas l'envoi", async () => {
    const result = await runWeeklyPortfolioProposals(new Date("2026-11-08T17:00:00Z"));
    expect(result).toMatchObject({ ran: false, skipped: true });
    expect(result.reason).toMatch(/lundi/);
  });
});
