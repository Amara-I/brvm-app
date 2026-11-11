import { describe, expect, it } from "vitest";
import {
  COMPANY_SHEET_TABS,
  isLegacySheetTab,
  normalizeSheetTab,
  sheetTabFromHash,
} from "./company-sheet-tabs";

describe("normalizeSheetTab", () => {
  it("conserve les onglets vivants", () => {
    expect(normalizeSheetTab("overview")).toBe("overview");
    expect(normalizeSheetTab("fundamental")).toBe("fundamental");
    expect(normalizeSheetTab("analyse-fondamentale")).toBe("fundamental");
    expect(normalizeSheetTab("charts")).toBe("charts");
    expect(normalizeSheetTab("projection")).toBe("projection");
    expect(normalizeSheetTab("comparison")).toBe("comparison");
    expect(normalizeSheetTab("Charts")).toBe("charts");
  });

  it("replie les onglets retirés vers Vue d'ensemble", () => {
    expect(normalizeSheetTab("dividends")).toBe("overview");
    expect(normalizeSheetTab("interims")).toBe("overview");
    expect(normalizeSheetTab("financials")).toBe("overview");
    expect(normalizeSheetTab("societe")).toBe("overview");
    expect(normalizeSheetTab("Société")).toBe("overview");
    expect(normalizeSheetTab("actualites")).toBe("overview");
    expect(normalizeSheetTab("Actualités")).toBe("overview");
    expect(normalizeSheetTab("documents")).toBe("overview");
    expect(normalizeSheetTab("#documents")).toBe("overview");
    expect(normalizeSheetTab("news")).toBe("overview");
  });

  it("n'expose plus Société, Actualités, Documents ni Dividendes", () => {
    const keys = COMPANY_SHEET_TABS.map((t) => t.key);
    const labels = COMPANY_SHEET_TABS.map((t) => t.label);
    expect(keys).toEqual(["overview", "fundamental", "charts", "projection", "comparison"]);
    expect(labels).toContain("Analyse fondamentale");
    expect(keys).not.toContain("societe");
    expect(keys).not.toContain("actualites");
    expect(keys).not.toContain("documents");
    expect(keys).not.toContain("dividends");
    expect(labels).toContain("Analyse Graphique");
    expect(labels).not.toContain("Graphes");
    expect(labels).not.toContain("Graphe");
    expect(labels).not.toContain("Société");
    expect(labels).not.toContain("Actualités");
    expect(labels).not.toContain("Documents");
    expect(labels).not.toContain("Dividendes");
  });
});

describe("sheetTabFromHash", () => {
  it("ouvre un onglet vivant et replie un onglet retiré", () => {
    expect(sheetTabFromHash("#charts")).toBe("charts");
    expect(sheetTabFromHash("#societe")).toBe("overview");
    expect(sheetTabFromHash("#actualites")).toBe("overview");
    expect(sheetTabFromHash("#documents")).toBe("overview");
    expect(isLegacySheetTab("#documents")).toBe(true);
    expect(isLegacySheetTab("#charts")).toBe(false);
  });

  it("ouvre l'analyse fondamentale et ignore un hash vraiment inconnu", () => {
    expect(sheetTabFromHash("")).toBeNull();
    expect(sheetTabFromHash("#fundamental")).toBe("fundamental");
    expect(sheetTabFromHash("#analyse-fondamentale")).toBe("fundamental");
    expect(sheetTabFromHash("#ancre-inconnue")).toBeNull();
    expect(isLegacySheetTab("#analyse-fondamentale")).toBe(false);
    expect(isLegacySheetTab("#fundamental")).toBe(false);
  });
});

describe("onglets de la fiche NGX", () => {
  it("mêmes onglets que la BRVM, sans Projection ni Comparaison", async () => {
    const { NGX_SHEET_TABS } = await import("./company-sheet-tabs");
    expect(NGX_SHEET_TABS.map((t) => t.key)).toEqual(["overview", "fundamental", "charts"]);
    expect(NGX_SHEET_TABS.map((t) => t.label)).toEqual(["Vue d'ensemble", "Analyse fondamentale", "Analyse Graphique"]);
  });

  it("anciennes ancres de la fiche NGX en une page", async () => {
    const { normalizeNgxSheetTab, ngxSheetTabFromHash } = await import("./company-sheet-tabs");
    expect(ngxSheetTabFromHash("#ngx-valuation")).toBe("fundamental");
    expect(ngxSheetTabFromHash("#ngx-conclusion")).toBe("fundamental");
    expect(ngxSheetTabFromHash("#ngx-presentation")).toBe("overview");
    expect(ngxSheetTabFromHash("#ngx-chart")).toBe("charts");
    expect(ngxSheetTabFromHash("#autre-ancre")).toBeNull();
    expect(normalizeNgxSheetTab("charts")).toBe("charts");
    expect(normalizeNgxSheetTab("projection")).toBe("overview");
    expect(normalizeNgxSheetTab("documents")).toBe("overview");
    expect(normalizeNgxSheetTab(undefined)).toBe("overview");
  });
});
