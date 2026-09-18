import { describe, expect, it } from "vitest";
import { COMPANY_SHEET_TABS, normalizeSheetTab } from "./company-sheet-tabs";

describe("normalizeSheetTab", () => {
  it("conserve les onglets vivants", () => {
    expect(normalizeSheetTab("overview")).toBe("overview");
    expect(normalizeSheetTab("documents")).toBe("documents");
    expect(normalizeSheetTab("charts")).toBe("charts");
  });

  it("replie Dividendes / Interims / Données financières vers Vue d'ensemble", () => {
    expect(normalizeSheetTab("dividends")).toBe("overview");
    expect(normalizeSheetTab("interims")).toBe("overview");
    expect(normalizeSheetTab("financials")).toBe("overview");
  });

  it("n'expose plus l'onglet Dividendes", () => {
    expect(COMPANY_SHEET_TABS.map((t) => t.key)).not.toContain("dividends");
    expect(COMPANY_SHEET_TABS.map((t) => t.label)).not.toContain("Dividendes");
  });
});
