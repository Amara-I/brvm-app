import { describe, expect, it } from "vitest";
import { ngxConfidenceLabel, ngxRiskLevel, ngxSignal } from "./signal";

describe("ngxSignal", () => {
  it("N/D sans note", () => {
    expect(ngxSignal(null, 50, "HIGH")).toBeNull();
  });
  it("applique la matrice BRVM (score × risque)", () => {
    expect(ngxSignal(80, 70, "HIGH")?.label).toBe("ACHAT FORT"); // risque 30
    expect(ngxSignal(80, 35, "HIGH")?.label).toBe("ACHAT"); // risque 65 → pas ACHAT FORT
    expect(ngxSignal(80, 20, "HIGH")?.label).toBe("CONSERVER"); // risque 80 → pas ACHAT
    expect(ngxSignal(55, 50, "HIGH")?.label).toBe("CONSERVER");
    expect(ngxSignal(30, 50, "HIGH")?.label).toBe("ALLÉGER");
    expect(ngxSignal(20, 20, "HIGH")?.label).toBe("VENDRE");
  });
  it("plafonne selon la confiance comme sur la BRVM", () => {
    expect(ngxSignal(80, 70, "MEDIUM")?.label).toBe("ACHAT");
    expect(ngxSignal(80, 70, "LOW")?.label).toBe("ACHAT");
    expect(ngxSignal(20, 20, "LOW")?.label).toBe("ALLÉGER");
    expect(ngxSignal(20, 20, "MEDIUM")?.label).toBe("VENDRE");
  });
  it("porte la couleur du signal", () => {
    expect(ngxSignal(55, 50, "HIGH")?.color).toMatch(/^#/);
  });
});

describe("ngxRiskLevel / ngxConfidenceLabel", () => {
  it("inverse le pilier risque, 50 par défaut", () => {
    expect(ngxRiskLevel(80)).toBe(20);
    expect(ngxRiskLevel(null)).toBe(50);
    expect(ngxRiskLevel(130)).toBe(0);
  });
  it("libellés français de la BRVM", () => {
    expect(ngxConfidenceLabel("HIGH")).toBe("Élevée");
    expect(ngxConfidenceLabel("MEDIUM")).toBe("Moyenne");
    expect(ngxConfidenceLabel("LOW")).toBe("Faible");
  });
});
