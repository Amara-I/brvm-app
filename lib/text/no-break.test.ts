import { describe, expect, it } from "vitest";
import { keepNumbersTogether, NBSP, NNBSP } from "./no-break";

describe("keepNumbersTogether", () => {
  it("rend insécables les milliers et l'unité", () => {
    expect(keepNumbersTogether("vers 246 932,60 pts testé")).toBe(`vers 246${NNBSP}932,60${NBSP}pts testé`);
    expect(keepNumbersTogether("à 4 197 FCFA (+3,6 %)")).toBe(`à 4${NNBSP}197${NBSP}FCFA (+3,6${NBSP}%)`);
    expect(keepNumbersTogether("1 234 567 FCFA")).toBe(`1${NNBSP}234${NNBSP}567${NBSP}FCFA`);
  });

  it("garde les espaces sécables autour d'un tiret et entre mots", () => {
    expect(keepNumbersTogether("4 100 – 4 300 FCFA")).toBe(`4${NNBSP}100 – 4${NNBSP}300${NBSP}FCFA`);
    expect(keepNumbersTogether("testé 5 fois : 3 rebonds")).toBe(`testé 5${NBSP}fois : 3 rebonds`);
  });

  it("ne colle pas deux nombres distincts", () => {
    expect(keepNumbersTogether("RSI 40 12")).toBe("RSI 40 12");
    expect(keepNumbersTogether("entre 2024 et 2026")).toBe("entre 2024 et 2026");
  });
});
