import { describe, expect, it } from "vitest";
import { companyDocumentKind, isResultsPublication } from "./document-kinds";

describe("isResultsPublication", () => {
  it("reconnaît les états financiers et résultats", () => {
    expect(isResultsPublication({ docType: "Etats financiers", title: "SNTS 2025" })).toBe(true);
    expect(isResultsPublication({ title: "Résultats semestriels 2026" })).toBe(true);
    expect(isResultsPublication({ filename: "rapport-annuel-2024.pdf" })).toBe(true);
    expect(isResultsPublication({ title: "Comptes consolidés 2025" })).toBe(true);
    expect(isResultsPublication({ periodLabel: "Trimestriel 2026" })).toBe(true);
  });

  it("laisse hors scope les avis non financiers", () => {
    expect(isResultsPublication({ title: "Avis de réunion — Assemblée générale" })).toBe(false);
    expect(isResultsPublication({ docType: "Dividende", filename: "coupon-2025.pdf" })).toBe(false);
    expect(isResultsPublication({ title: null, filename: null, docType: null })).toBe(false);
  });

  it("privilégie « résultats » même si le titre mentionne aussi un dividende", () => {
    expect(
      isResultsPublication({ title: "Résultats annuels 2025 et proposition de dividende" })
    ).toBe(true);
  });
});

describe("companyDocumentKind", () => {
  it("étiquette results vs other", () => {
    expect(companyDocumentKind({ title: "États financiers 2024" })).toBe("results");
    expect(companyDocumentKind({ title: "Statuts à jour" })).toBe("other");
  });
});
