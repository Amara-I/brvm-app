import { beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const m = vi.hoisted(() => ({ discovery: vi.fn(), pages: vi.fn(), reserve: vi.fn(), envelope: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./discovery", () => ({ discoverFinancialSources: m.discovery }));
vi.mock("./document", () => ({ financialPages: m.pages, trustedDocumentUrl: () => true }));
vi.mock("./budget", async (original) => ({ ...await original<typeof import("./budget")>(), reserveBudget: m.reserve, costEnvelope: m.envelope }));
vi.mock("ai", () => ({ generateText: m.generate, gateway: (id: string) => id, Output: { object: () => ({}) } }));
import { runFinanceAgent } from "./run";
const fakeDb = () => ({
  company: { findMany: vi.fn(async () => [{ id: "c1", ticker: "SNTS", name: "Sonatel", exchange: "BRVM", financialRatios: [] }]) },
  ingestionLog: { findMany: vi.fn(async () => []), create: vi.fn() },
  companyDocument: { findMany: vi.fn(async () => [{ id: "doc", title: "rapport", url: "https://www.brvm.org/report.pdf", publishedAt: null, sourceName: "BRVM" }]) },
  researchFinding: { findUnique: vi.fn(async () => null), createMany: vi.fn(async () => ({ count: 1 })) },
});
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("FINANCE_AGENT_ENABLED", "true"); vi.stubEnv("FINANCE_AGENT_AI_ENABLED", "true"); vi.stubEnv("FINANCE_AGENT_CATALOG_ENABLED", "false");
  m.discovery.mockResolvedValue([]); m.envelope.mockReturnValue({ model: "provider/model", provider: "provider", inputEurPerMillion: 1, outputEurPerMillion: 5, expiresAt: "2099-01-01" });
  m.pages.mockResolvedValue([{ page: 2, text: "Revenue 1,000 NGN millions group year 2025" }]);
});
it("désactivé = aucun réseau/base/IA", async () => {
  vi.stubEnv("FINANCE_AGENT_ENABLED", "false"); const db = fakeDb();
  expect((await runFinanceAgent(db as unknown as PrismaClient)).enabled).toBe(false);
  expect(db.company.findMany).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
});
it("budget atteint = aucun appel modèle", async () => {
  m.reserve.mockResolvedValue(false); const result = await runFinanceAgent(fakeDb() as unknown as PrismaClient);
  expect(result.aiStatus).toBe("MONTHLY_CAP_REACHED"); expect(m.generate).not.toHaveBeenCalled();
});
it("tarifs non vérifiés = recherche gratuite seulement", async () => {
  m.envelope.mockReturnValue(null); const result = await runFinanceAgent(fakeDb() as unknown as PrismaClient);
  expect(result.aiStatus).toBe("BLOCKED_UNVERIFIED_COST_OR_PROVIDER_CAP"); expect(m.reserve).not.toHaveBeenCalled(); expect(m.generate).not.toHaveBeenCalled();
});
it("une erreur après réservation ne rembourse rien et ne publie aucun chiffre", async () => {
  m.reserve.mockResolvedValue(true); m.generate.mockRejectedValue(new Error("timeout")); const db = fakeDb();
  const result = await runFinanceAgent(db as unknown as PrismaClient);
  expect(result.reservedCents).toBeGreaterThan(0); expect(result.aiStatus).toBe("FAILED_CLOSED_RESERVATION_RETAINED");
  expect(db.researchFinding.createMany).not.toHaveBeenCalled();
});
it("l’extraction est enregistrée uniquement comme proposition non canonique", async () => {
  m.reserve.mockResolvedValue(true); m.generate.mockResolvedValue({ output: { company: "Sonatel", observations: [{ year: 2025, field: "revenue", valueAsPrinted: "1,000", currency: "NGN", unit: "millions", scope: "group", page: 2, evidence: "Revenue 1,000 NGN millions group year 2025", caveat: "" }] } });
  const db = fakeDb(); const result = await runFinanceAgent(db as unknown as PrismaClient);
  expect(result.aiStatus).toBe("PENDING_HUMAN_REVIEW"); expect(result.proposals).toBe(1);
  expect(db.researchFinding.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ summary: expect.stringContaining("PENDING_HUMAN_REVIEW") })] }));
  expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, maxOutputTokens: 1800,
    providerOptions: { gateway: { only: ["provider"], tags: ["ouestbourse-finance-agent"] } } }));
  // Le contrat du job n’a aucune primitive de création/update de prix ou comptes dans la base simulée.
});
it("un délai trop court saute l'IA, sans appel modèle ni rotation du curseur", async () => {
  const db = fakeDb();
  const result = await runFinanceAgent(db as unknown as PrismaClient, { deadlineMs: Date.now() + 8_000 });
  expect(result.aiStatus).toBe("SKIPPED_TIME_BUDGET");
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.reserve).not.toHaveBeenCalled();
  expect(db.ingestionLog.create).not.toHaveBeenCalled();
});
it("un délai déjà épuisé ne touche pas la base", async () => {
  const db = fakeDb();
  const result = await runFinanceAgent(db as unknown as PrismaClient, { deadlineMs: Date.now() - 1 });
  expect(result.aiStatus).toBe("SKIPPED_TIME_BUDGET");
  expect(result.enabled).toBe(true);
  expect(db.company.findMany).not.toHaveBeenCalled();
});
