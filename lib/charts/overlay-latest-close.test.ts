import { describe, expect, it } from "vitest";
import { overlayLatestClose, overlayLatestCloses, seriesBehindLatest } from "./overlay-latest-close";

const p = (time: string, value: number) => ({ time, value, volume: null });

describe("overlayLatestClose", () => {
  it("remplace le cours provisoire du même jour par la clôture (cas SLBC 12/11)", () => {
    const cached = [p("2026-11-11", 40000), p("2026-11-12", 40000)];
    const latest = { date: "2026-11-12", close: 42945 };
    expect(seriesBehindLatest(cached, latest)).toBe(true);
    const out = overlayLatestClose(cached, latest);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual(p("2026-11-12", 42945));
    expect(cached[1]!.value).toBe(40000); // pas de mutation
  });

  it("ajoute une nouvelle séance", () => {
    const out = overlayLatestClose([p("2026-11-12", 42945)], { date: "2026-11-13", close: 42950 });
    expect(out.map((x) => x.time)).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("ne touche à rien si le cours est déjà le bon ou plus ancien", () => {
    const s = [p("2026-11-13", 2170)];
    expect(seriesBehindLatest(s, { date: "2026-11-13", close: 2170 })).toBe(false);
    expect(overlayLatestClose(s, { date: "2026-11-12", close: 2030 })).toEqual(s);
    expect(overlayLatestClose(s, null)).toEqual(s);
    expect(overlayLatestClose(s, { date: "2026-11-14", close: 0 })).toEqual(s);
  });

  it("série vide : le dernier cours devient le premier point", () => {
    expect(overlayLatestClose([], { date: "2026-11-13", close: 10 })).toEqual([p("2026-11-13", 10)]);
  });

  it("superpose par ticker", () => {
    const out = overlayLatestCloses(
      { A: [p("2026-11-12", 1)], B: [p("2026-11-12", 2)] },
      new Map([["A", { date: "2026-11-12", close: 1.5 }]])
    );
    expect(out.A![0]!.value).toBe(1.5);
    expect(out.B![0]!.value).toBe(2);
  });
});
