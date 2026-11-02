import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { costEnvelope, reservationCents, reserveBudget, spentCents, monthWindow, MONTHLY_LIMIT_CENTS, BUDGET_KIND } from "./budget";
const now = new Date("2026-11-02T00:00:00Z");
const env = { FINANCE_AGENT_PROVIDER_CAP_VERIFIED: "true", FINANCE_AGENT_MODEL: "provider/model", FINANCE_AGENT_PROVIDER: "provider", FINANCE_AGENT_INPUT_EUR_PER_MILLION: "1", FINANCE_AGENT_OUTPUT_EUR_PER_MILLION: "5", FINANCE_AGENT_PRICE_VALID_UNTIL: "2026-11-20" };
describe("plafond utilisateur 25 EUR", () => {
  it("refuse l’IA tant que plafond fournisseur, prix et conversion ne sont pas validés", () => {
    expect(costEnvelope({}, now)).toBeNull(); expect(costEnvelope({ ...env, FINANCE_AGENT_PROVIDER_CAP_VERIFIED: "false" }, now)).toBeNull();
    expect(costEnvelope({ ...env, FINANCE_AGENT_INPUT_EUR_PER_MILLION: "NaN" }, now)).toBeNull();
    expect(costEnvelope({ ...env, FINANCE_AGENT_PRICE_VALID_UNTIL: "2026-11-01" }, now)).toBeNull();
    expect(costEnvelope({ ...env, FINANCE_AGENT_PRICE_VALID_UNTIL: "2027-11-01" }, now)).toBeNull();
    expect(costEnvelope(env, now)?.model).toBe("provider/model");
  });
  it("réserve un majorant avec marge et minimum de 5 centimes", () => {
    expect(reservationCents(100, 100, costEnvelope(env, now)!)).toBeGreaterThanOrEqual(5);
    expect(reservationCents(60000, 1800, costEnvelope(env, now)!)).toBeGreaterThan(reservationCents(100, 100, costEnvelope(env, now)!));
  });
  it("les états invalides ferment le budget au lieu de le remettre à zéro", () => {
    expect(spentCents([{ errors: { kind: BUDGET_KIND, cents: -2 } }])).toBe(MONTHLY_LIMIT_CENTS);
    expect(spentCents([{ errors: { kind: "OTHER", cents: 8000 } }])).toBe(0);
  });
  it("utilise le mois UTC", () => expect(monthWindow(now)).toEqual({ start: new Date("2026-11-01"), end: new Date("2026-12-01") }));
  it("refuse le dépassement même d’un centime sans réserver", async () => {
    const create = vi.fn(); const tx = { $executeRawUnsafe: vi.fn(), ingestionLog: { findMany: vi.fn(async () => [{ errors: { kind: BUDGET_KIND, cents: 2496 } }]), create } };
    const db = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
    expect(await reserveBudget(db, 5, "test", now)).toBe(false); expect(create).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_xact_lock"));
  });
  it("deux réservations concurrentes passent par la même section sérialisée", async () => {
    const rows: { errors: unknown }[] = [{ errors: { kind: BUDGET_KIND, cents: 2495 } }];
    const tx = { $executeRawUnsafe: vi.fn(), ingestionLog: { findMany: async () => rows, create: async (arg: { data: { errors: unknown } }) => { rows.push({ errors: arg.data.errors }); } } };
    let queue = Promise.resolve();
    const db = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
      const result = queue.then(() => fn(tx)); queue = result.then(() => undefined, () => undefined); return result;
    } } as unknown as PrismaClient;
    const result = await Promise.all([reserveBudget(db, 5, "one", now), reserveBudget(db, 5, "two", now)]);
    expect(result).toEqual([true, false]); expect(spentCents(rows)).toBe(2500);
  });
});
