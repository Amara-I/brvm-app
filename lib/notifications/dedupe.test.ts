import { describe, expect, it } from "vitest";
import { amountKey, collapseDuplicateNotifications, dedupeKey, isUniqueViolation, sessionDateOf } from "./dedupe";

const base = {
  type: "PORTEFEUILLE",
  title: "SHEC (ligne) : +6,9 % aujourd'hui",
  body: "Variation ≥ +5,0 % sur une position. Cours 2170 FCFA.",
  ticker: "SHEC",
  indexCode: null,
};

describe("clés anti-doublon", () => {
  it("sont stables et normalisées", () => {
    expect(dedupeKey("pf_move", "shec", "2026-11-13")).toBe("PF_MOVE:SHEC:2026-11-13");
    expect(dedupeKey("SIGNAL", "MTNN", "ACHAT FORT", "2026-11-13")).toBe("SIGNAL:MTNN:ACHAT_FORT:2026-11-13");
    expect(dedupeKey("INDEX", "NGX_ASI", null, "2026-11-13")).toBe("INDEX:NGX_ASI:2026-11-13");
    expect(amountKey(2170)).toBe(amountKey(2170.0)); // Decimal 2170.0000 → même clé
    expect(amountKey(29.505)).toBe("29.51");
    expect(sessionDateOf(new Date("2026-11-13T00:00:00.000Z"))).toBe("2026-11-13");
  });
  it("reconnaît une violation d'unicité Prisma", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

describe("collapseDuplicateNotifications", () => {
  it("regroupe les 3 notifications SHEC identiques en une seule (la plus récente)", () => {
    const rows = [
      { ...base, id: "c", readAt: null, createdAt: "2026-11-15T17:05:00Z" },
      { ...base, id: "b", readAt: "2026-11-14T18:00:00Z", createdAt: "2026-11-14T17:05:00Z" },
      { ...base, id: "a", readAt: null, createdAt: "2026-11-13T17:05:00Z" },
    ];
    const out = collapseDuplicateNotifications(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "c", duplicateCount: 3, readAt: null });
  });
  it("un groupe entièrement lu reste lu ; une information différente reste séparée", () => {
    const rows = [
      { ...base, id: "b", readAt: "2026-11-14T18:00:00Z", createdAt: "2026-11-14T17:05:00Z" },
      { ...base, id: "a", readAt: "2026-11-14T18:00:00Z", createdAt: "2026-11-13T17:05:00Z" },
      { ...base, id: "n", title: "SHEC (ligne) : +5,2 % aujourd'hui", body: "Variation ≥ +5,0 % sur une position. Cours 2283 FCFA.", readAt: null, createdAt: "2026-11-16T17:05:00Z" },
    ];
    const out = collapseDuplicateNotifications(rows);
    expect(out.map((n) => n.id)).toEqual(["b", "n"]);
    expect(out[0].readAt).toBe("2026-11-14T18:00:00Z");
  });
});
