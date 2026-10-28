import { describe, expect, it } from "vitest";
import { createFormat } from "@/lib/i18n/format";
import { measureText, ohlcLegend, priceText } from "./chart-locale";

describe("chart-locale : décimales NGX, BRVM inchangé", () => {
  const format = createFormat("fr");
  it("priceText par défaut (BRVM) = entier", () => {
    expect(priceText(4350.4, format)).toBe(format.integer(4350.4));
  });
  it("priceText NGX = 2 décimales", () => {
    expect(priceText(4.35, format, 2)).toBe(format.decimal(4.35, 2));
    expect(priceText(4.35, format, 2)).not.toBe(format.integer(4.35));
  });
  it("ohlcLegend / measureText : défaut identique à decimals = 0", () => {
    expect(ohlcLegend(1, 2, 3, 4, 1.5, 10, "fr", format)).toBe(ohlcLegend(1, 2, 3, 4, 1.5, 10, "fr", format, 0));
    expect(measureText(100, 110, "fr", format)).toBe(measureText(100, 110, "fr", format, 0));
  });
});

describe("garde anti-boucle de rendu (props de TradingChart stables)", async () => {
  const { readFileSync } = await import("node:fs");
  const wb = readFileSync(new URL("./ChartWorkbench.tsx", import.meta.url), "utf8");
  const ngx = readFileSync(new URL("../ngx/NgxChart.tsx", import.meta.url), "utf8");
  const block = wb.slice(wb.indexOf("<TradingChart"), wb.indexOf("/>", wb.indexOf("onRemoveIndicator")));
  it("aucun littéral [] / {} inline dans les props de TradingChart", () => {
    expect(block).not.toMatch(/(series|Series|markers|Markers|indicators)=\{\s*(\[\s*\]|\{\s*\})/);
  });
  it("séries et comparaisons passées au graphe viennent de useMemo", () => {
    expect(wb).toMatch(/const historySeries = useMemo\(/);
    expect(wb).toMatch(/const windowSeries = useMemo\(/);
    expect(wb).toMatch(/const compareSeries = useMemo\(/);
  });
  it("NgxChart ne recrée ni objet ni tableau pour le workbench", () => {
    const jsx = ngx.slice(ngx.indexOf("<LazyChartWorkbench"));
    expect(jsx).not.toMatch(/=\{\s*(\[|\{)/);
  });
});
