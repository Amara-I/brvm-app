import { describe, expect, it } from "vitest";
import {
  catalogToUniverse,
  chartWorkbenchHref,
  defaultChartInstrument,
  findChartInstrument,
  normalizeInstrumentSymbol,
  resolveChartInstrument,
  splitPrefixedSymbol,
  universeItemKey,
  filterUniverse,
  groupUniverse,
  type ChartUniverseItem,
} from "./chart-selection";
import { chartCatalogHref, chartCatalogKey, type ChartCatalogEntry } from "./chart-catalog-core";

function entry(
  partial: Pick<ChartCatalogEntry, "symbol" | "name" | "exchange" | "kind"> & Partial<ChartCatalogEntry>
): ChartCatalogEntry {
  const base = { kind: partial.kind, symbol: partial.symbol, exchange: partial.exchange };
  return {
    key: chartCatalogKey(base),
    sector: partial.sector ?? null,
    countryFlag: partial.countryFlag ?? "",
    color: partial.color ?? "#D4A843",
    href: chartCatalogHref(base),
    ...partial,
  };
}

const catalog = [
  entry({ symbol: "SNTS", name: "Sonatel", exchange: "BRVM", kind: "company" }),
  entry({ symbol: "ABJC", name: "Servair Abidjan", exchange: "BRVM", kind: "company" }),
  entry({ symbol: "BRVM_COMPOSITE", name: "BRVM Composite", exchange: "BRVM", kind: "index" }),
  entry({ symbol: "BRVM_30", name: "BRVM 30", exchange: "BRVM", kind: "index" }),
  entry({ symbol: "DANGCEM", name: "Dangote Cement", exchange: "NGX", kind: "company" }),
  entry({ symbol: "NGX_ASI", name: "NGX All-Share Index", exchange: "NGX", kind: "index" }),
  entry({ symbol: "NGX30", name: "NGX 30", exchange: "NGX", kind: "index" }),
];

describe("chartWorkbenchHref", () => {
  it("conserve les liens historiques ?ticker= pour une action BRVM", () => {
    expect(chartWorkbenchHref({ kind: "company", symbol: "snts", exchange: "BRVM" })).toBe(
      "/graphes?ticker=SNTS"
    );
  });

  it("préfixe la place pour une action NGX", () => {
    expect(chartWorkbenchHref({ kind: "company", symbol: "DANGCEM", exchange: "NGX" })).toBe(
      "/graphes?ticker=NGX%3ADANGCEM"
    );
  });

  it("encode un indice BRVM dans ?indice=", () => {
    expect(chartWorkbenchHref({ kind: "index", symbol: "BRVM_COMPOSITE", exchange: "BRVM" })).toBe(
      "/graphes?indice=BRVM_COMPOSITE"
    );
  });

  it("préfixe la place pour un indice NGX", () => {
    expect(chartWorkbenchHref({ kind: "index", symbol: "NGX_ASI", exchange: "NGX" })).toBe(
      "/graphes?indice=NGX%3ANGX_ASI"
    );
  });
});

describe("splitPrefixedSymbol / normalize", () => {
  it("sépare NGX:DANGCEM", () => {
    expect(splitPrefixedSymbol("ngx:dangcem")).toEqual({ exchange: "NGX", symbol: "DANGCEM" });
  });

  it("normalise tirets et espaces en underscores", () => {
    expect(normalizeInstrumentSymbol("brvm-composite")).toBe("BRVM_COMPOSITE");
    expect(normalizeInstrumentSymbol("BRVM Composite")).toBe("BRVM_COMPOSITE");
  });
});

describe("findChartInstrument", () => {
  it("résout ?ticker=SNTS (lien historique)", () => {
    const found = findChartInstrument({ ticker: "SNTS" }, catalog);
    expect(found?.symbol).toBe("SNTS");
    expect(found?.exchange).toBe("BRVM");
    expect(found?.kind).toBe("company");
  });

  it("résout ?ticker=NGX:DANGCEM", () => {
    const found = findChartInstrument({ ticker: "NGX:DANGCEM" }, catalog);
    expect(found?.symbol).toBe("DANGCEM");
    expect(found?.exchange).toBe("NGX");
  });

  it("résout un ticker NGX sans préfixe s'il n'existe pas à la BRVM", () => {
    const found = findChartInstrument({ ticker: "dangcem" }, catalog);
    expect(found?.symbol).toBe("DANGCEM");
    expect(found?.exchange).toBe("NGX");
  });

  it("résout ?indice=BRVM_COMPOSITE et l'alias BRVM-C", () => {
    expect(findChartInstrument({ indice: "BRVM_COMPOSITE" }, catalog)?.symbol).toBe("BRVM_COMPOSITE");
    expect(findChartInstrument({ indice: "BRVM-C" }, catalog)?.symbol).toBe("BRVM_COMPOSITE");
    expect(findChartInstrument({ indice: "brvm-composite" }, catalog)?.symbol).toBe("BRVM_COMPOSITE");
  });

  it("résout ?indice=NGX:NGX_ASI et l'alias ASI", () => {
    expect(findChartInstrument({ indice: "NGX:NGX_ASI" }, catalog)?.symbol).toBe("NGX_ASI");
    expect(findChartInstrument({ indice: "ASI" }, catalog)?.symbol).toBe("NGX_ASI");
  });

  it("résout NGX30 via ?indice=NGX-30", () => {
    expect(findChartInstrument({ indice: "NGX-30" }, catalog)?.symbol).toBe("NGX30");
  });

  it("retourne null pour un symbole inconnu", () => {
    expect(findChartInstrument({ ticker: "ZZZZ" }, catalog)).toBeNull();
  });
});

describe("resolveChartInstrument", () => {
  it("affiche ABJC par défaut, sans paramètre", () => {
    expect(resolveChartInstrument({}, catalog)?.symbol).toBe("ABJC");
  });

  it("retombe sur ABJC si le paramètre est inconnu", () => {
    expect(resolveChartInstrument({ ticker: "INCONNU" }, catalog)?.symbol).toBe("ABJC");
  });

  it("prend la première action BRVM si ABJC est absent", () => {
    const withoutAbjc = catalog.filter((e) => e.symbol !== "ABJC");
    expect(defaultChartInstrument(withoutAbjc)?.symbol).toBe("SNTS");
  });

  it("préfère l'indice demandé à un ticker présent en même temps", () => {
    expect(resolveChartInstrument({ ticker: "SNTS", indice: "BRVM_30" }, catalog)?.symbol).toBe(
      "BRVM_30"
    );
  });
});

describe("catalogToUniverse", () => {
  it("ne garde que BRVM et NGX et propage kind / exchange", () => {
    const mixed = [
      ...catalog,
      entry({ symbol: "NPN", name: "Naspers", exchange: "JSE", kind: "company" }),
    ];
    const universe: ChartUniverseItem[] = catalogToUniverse(mixed);
    expect(universe.find((u) => u.ticker === "NPN")).toBeUndefined();
    expect(universe).toHaveLength(catalog.length);
    const dangote = universe.find((u) => u.ticker === "DANGCEM");
    expect(dangote).toMatchObject({ kind: "company", exchange: "NGX", name: "Dangote Cement" });
    expect(universeItemKey(dangote!)).toBe("NGX:company:DANGCEM");
    expect(universeItemKey({ ticker: "SNTS" })).toBe("BRVM:company:SNTS");
  });
});

describe("filterUniverse / groupUniverse", () => {
  const items = catalogToUniverse(catalog);

  it("filtre sans accents et trouve Dangote", () => {
    expect(filterUniverse(items, "dangote").map((i) => i.ticker)).toEqual(["DANGCEM"]);
    expect(filterUniverse(items, "BRVM").length).toBeGreaterThanOrEqual(4);
  });

  it("regroupe dans l'ordre BRVM actions / indices, puis NGX", () => {
    expect(groupUniverse(items).map((g) => g.id)).toEqual([
      "BRVM-company",
      "BRVM-index",
      "NGX-company",
      "NGX-index",
    ]);
  });
});
