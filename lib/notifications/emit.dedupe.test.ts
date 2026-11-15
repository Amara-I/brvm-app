// emitNotification : anti-doublon à la source (Prisma simulé).
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), user: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationEvent: { findFirst: m.findFirst, create: m.create, update: m.update },
    user: { findUnique: m.user },
  },
}));
vi.mock("@/lib/notifications/email", () => ({ sendNotificationEmail: m.send }));
vi.mock("@/lib/notifications/prefs", () => ({ getOrCreatePrefs: vi.fn() }));

import { emitNotification } from "./emit";
import { DEFAULT_PREFS } from "./types";

const NOW = new Date("2026-11-15T17:05:00.000Z");
const input = {
  userId: "u1",
  type: "PORTEFEUILLE" as const,
  title: "SHEC (ligne) : +6,9 % aujourd'hui",
  body: "Variation ≥ +5,0 % sur une position. Cours 2170 FCFA.",
  ticker: "SHEC",
  href: "/portefeuille",
  prefs: DEFAULT_PREFS,
  now: NOW,
  payload: { change: 6.9 },
  dedupeKey: "PF_MOVE:SHEC:2026-11-13",
};

beforeEach(() => {
  vi.resetAllMocks();
  m.findFirst.mockResolvedValue(null);
  m.create.mockResolvedValue({ id: "ev1" });
});

describe("emitNotification — une information, une notification", () => {
  it("crée l'événement avec la clé dans le payload", async () => {
    const res = await emitNotification(input);
    expect(res).toEqual({ created: true, id: "ev1", emailed: false });
    expect(m.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", payload: { path: ["dedupeKey"], equals: "PF_MOVE:SHEC:2026-11-13" } },
      select: { id: true },
    });
    expect(m.create.mock.calls[0][0].data.payload).toEqual({ change: 6.9, dedupeKey: "PF_MOVE:SHEC:2026-11-13" });
  });

  it("clé déjà présente (même lue) → rien n'est recréé", async () => {
    m.findFirst.mockResolvedValueOnce({ id: "old" });
    expect(await emitNotification(input)).toEqual({ created: false, reason: "duplicate" });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("même texte récent (événement créé avant les clés) → doublon", async () => {
    m.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "legacy" });
    expect(await emitNotification(input)).toEqual({ created: false, reason: "duplicate" });
    const where = m.findFirst.mock.calls[1][0].where;
    expect(where).toMatchObject({ userId: "u1", type: "PORTEFEUILLE", title: input.title, body: input.body, ticker: "SHEC" });
    expect(where.createdAt.gte.getTime()).toBe(NOW.getTime() - 14 * 86_400_000);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("rappel de séance : pas de repli texte, seule la clé du jour compte", async () => {
    await emitNotification({ ...input, type: "SYSTEME", allowSameText: true, dedupeKey: "SESSION:CLOSE:2026-11-15" });
    expect(m.findFirst).toHaveBeenCalledTimes(1);
    expect(m.create).toHaveBeenCalled();
  });

  it("course entre deux évaluations (index unique) → doublon, pas d'erreur", async () => {
    m.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    expect(await emitNotification(input)).toEqual({ created: false, reason: "duplicate" });
  });
});
