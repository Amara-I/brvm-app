import { beforeEach, describe, expect, it, vi } from "vitest";
import { isWeeklyProposalsDay, runWeeklyPortfolioProposals } from "./monday-hooks";

const dispatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/portfolio-analysis/weekly-dispatch", () => ({
  dispatchWeeklyPortfolioProposals: dispatch,
}));

describe("runWeeklyPortfolioProposals", () => {
  beforeEach(() => {
    dispatch.mockReset();
    dispatch.mockResolvedValue({ users: 2, notified: 1, optedOut: 1, duplicates: 0, errors: 0 });
  });

  it("reconnaît le lundi UTC", () => {
    expect(isWeeklyProposalsDay(new Date("2026-11-09T06:00:00Z"))).toBe(true);
    expect(isWeeklyProposalsDay(new Date("2026-11-08T17:00:00Z"))).toBe(false);
  });

  it("le lundi lance l'envoi des propositions", async () => {
    const result = await runWeeklyPortfolioProposals(new Date("2026-11-09T06:00:00Z"));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(result.ran).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.notified).toBe(1);
    expect(result.optedOut).toBe(1);
  });

  it("un autre jour ne déclenche pas l'envoi", async () => {
    const result = await runWeeklyPortfolioProposals(new Date("2026-11-08T17:00:00Z"));
    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ran: false, skipped: true });
    expect(result.reason).toMatch(/lundi/);
  });
});
