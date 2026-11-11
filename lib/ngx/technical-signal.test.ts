import { describe, expect, it } from "vitest";
import { clearTechnicalAnalysisCache } from "@/lib/technical-analysis/cache";
import { fixtureSeries } from "./__fixtures__";
import { NGX_SIGNAL_WINDOW_DAYS, ngxSignalWindow, ngxTechnicalAnalysis, ngxTechnicalSignal } from "./technical-signal";

describe("signal technique NGX", () => {
  it("N/D sans clôture", () => {
    expect(ngxTechnicalSignal([])).toBeNull();
    expect(ngxTechnicalSignal(null)).toBeNull();
  });

  it("fenêtre partagée : 1 an + 420 jours avant la dernière clôture", () => {
    const series = fixtureSeries(1200);
    const window = ngxSignalWindow(series);
    const last = series[series.length - 1]!.time;
    const from = new Date(`${last}T00:00:00.000Z`);
    from.setUTCDate(from.getUTCDate() - NGX_SIGNAL_WINDOW_DAYS);
    expect(window[0]!.time >= from.toISOString().slice(0, 10)).toBe(true);
    expect(window[window.length - 1]!.time).toBe(last);
    expect(window.length).toBeLessThan(series.length);
  });

  it("même signal que l'analyse de la fiche, prix en naira", () => {
    clearTechnicalAnalysisCache();
    const series = fixtureSeries(500);
    const analysis = ngxTechnicalAnalysis(series);
    const sig = ngxTechnicalSignal(series)!;
    expect(analysis.currency).toBe("NGN");
    expect(sig.signal.label).toBe(analysis.signal.label);
    expect(sig.confidence).toBe(analysis.signal.confidence);
    const text = analysis.scenarios.map((s) => `${s.explanationFr} ${s.explanationEn}`).join(" ");
    expect(text).not.toContain("FCFA");
  });

  it("titre peu liquide : confiance basse, jamais de signal fort", () => {
    const flat = fixtureSeries(200, 50, 0, 0).map((p, i) => ({ ...p, value: i % 9 === 0 ? 51 : 50, volume: 0 }));
    const sig = ngxTechnicalSignal(flat)!;
    expect(sig.illiquid).toBe(true);
    expect(sig.confidence).toBe("Faible");
    expect(["ACHAT FORT", "VENDRE"]).not.toContain(sig.signal.label);
    expect(sig.liquidityWarningFr).toBeTruthy();
  });
});
