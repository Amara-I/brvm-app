import { describe, expect, it } from "vitest";
import { deriveSourceRunStatus } from "./status";

describe("deriveSourceRunStatus", () => {
  it("retourne PARTIAL si rien n'a été tenté (tout désactivé)", () => {
    expect(deriveSourceRunStatus([{ attempted: false, ok: false }])).toBe("PARTIAL");
    expect(deriveSourceRunStatus([])).toBe("PARTIAL");
  });

  it("retourne SUCCESS si tous les appels tentés réussissent", () => {
    expect(
      deriveSourceRunStatus([
        { attempted: true, ok: true },
        { attempted: true, ok: true },
      ])
    ).toBe("SUCCESS");
  });

  it("retourne SUCCESS si les appels réussis coexistent avec des appels désactivés", () => {
    expect(
      deriveSourceRunStatus([
        { attempted: true, ok: true },
        { attempted: false, ok: false },
      ])
    ).toBe("SUCCESS");
  });

  it("retourne FAILED si tous les appels tentés échouent", () => {
    expect(
      deriveSourceRunStatus([
        { attempted: true, ok: false },
        { attempted: true, ok: false },
      ])
    ).toBe("FAILED");
  });

  it("retourne PARTIAL en cas de mélange réussite/échec", () => {
    expect(
      deriveSourceRunStatus([
        { attempted: true, ok: true },
        { attempted: true, ok: false },
      ])
    ).toBe("PARTIAL");
  });
});
