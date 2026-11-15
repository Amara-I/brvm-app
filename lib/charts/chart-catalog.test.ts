import { describe, expect, it } from "vitest";
import {
  chartCatalogHref,
  chartCatalogKey,
  filterChartCatalog,
  groupChartCatalog,
  hiddenCatalogCounts,
  indexSortRank,
  type ChartCatalogEntry,
} from "./chart-catalog-core";

function entry(
  partial: Pick<ChartCatalogEntry, "symbol" | "name" | "exchange" | "kind"> &
    Partial<ChartCatalogEntry>
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

describe("chartCatalogHref", () => {
  it("ouvre le workbench BRVM pour une action BRVM", () => {
    expect(chartCatalogHref({ kind: "company", symbol: "snts", exchange: "BRVM" })).toBe(
      "/graphes?ticker=SNTS"
    );
  });

  it("ouvre l'onglet graphique de la fiche NGX", () => {
    expect(chartCatalogHref({ kind: "company", symbol: "MTNN", exchange: "NGX" })).toBe(
      "/marches/ngx/actions/MTNN?tab=charts"
    );
  });

  it("ouvre la fiche d'indice BRVM (graphe déjà sur la page)", () => {
    expect(chartCatalogHref({ kind: "index", symbol: "BRVM_COMPOSITE", exchange: "BRVM" })).toBe(
      "/indices/BRVM_COMPOSITE"
    );
  });

  it("ouvre le workbench détaillé d'un indice NGX", () => {
    expect(chartCatalogHref({ kind: "index", symbol: "NGX_ASI", exchange: "NGX" })).toBe(
      "/marches/ngx/indices/NGX_ASI?vue=graphe"
    );
  });

  it("suit le schéma /marches/{place} pour une place ajoutée plus tard", () => {
    expect(chartCatalogHref({ kind: "company", symbol: "NPN", exchange: "JSE" })).toBe(
      "/marches/jse/actions/NPN?tab=charts"
    );
    expect(chartCatalogHref({ kind: "index", symbol: "JSE_ALSI", exchange: "JSE" })).toBe(
      "/marches/jse/indices/JSE_ALSI"
    );
  });
});

describe("groupChartCatalog", () => {
  it("regroupe par place puis type, BRVM puis NGX, actions avant indices", () => {
    const groups = groupChartCatalog([
      entry({ symbol: "NGX_ASI", name: "ASI", exchange: "NGX", kind: "index" }),
      entry({ symbol: "SNTS", name: "Sonatel", exchange: "BRVM", kind: "company" }),
      entry({ symbol: "MTNN", name: "MTN", exchange: "NGX", kind: "company" }),
      entry({ symbol: "BRVM_COMPOSITE", name: "Composite", exchange: "BRVM", kind: "index" }),
      entry({ symbol: "ABJC", name: "GEC", exchange: "BRVM", kind: "company" }),
    ]);
    expect(groups.map((g) => g.id)).toEqual([
      "BRVM-company",
      "BRVM-index",
      "NGX-company",
      "NGX-index",
    ]);
    expect(groups[0]?.items.map((i) => i.symbol)).toEqual(["ABJC", "SNTS"]);
    expect(groups[1]?.items.map((i) => i.symbol)).toEqual(["BRVM_COMPOSITE"]);
  });

  it("place les indices de référence en tête", () => {
    expect(indexSortRank("NGX_ASI")).toBeLessThan(indexSortRank("NGX30"));
    expect(indexSortRank("BRVM_COMPOSITE")).toBeLessThan(indexSortRank("BRVM_30"));
    const group = groupChartCatalog([
      entry({ symbol: "BRVM_PRESTIGE", name: "Prestige", exchange: "BRVM", kind: "index" }),
      entry({ symbol: "BRVM_30", name: "30", exchange: "BRVM", kind: "index" }),
      entry({ symbol: "BRVM_COMPOSITE", name: "Composite", exchange: "BRVM", kind: "index" }),
    ]);
    expect(group[0]?.items.map((i) => i.symbol)).toEqual([
      "BRVM_COMPOSITE",
      "BRVM_30",
      "BRVM_PRESTIGE",
    ]);
  });

  it("ajoute automatiquement une nouvelle place après NGX", () => {
    const groups = groupChartCatalog([
      entry({ symbol: "NPN", name: "Naspers", exchange: "JSE", kind: "company" }),
      entry({ symbol: "SNTS", name: "Sonatel", exchange: "BRVM", kind: "company" }),
    ]);
    expect(groups.map((g) => g.id)).toEqual(["BRVM-company", "JSE-company"]);
  });
});

describe("filterChartCatalog", () => {
  const list = [
    entry({ symbol: "SNTS", name: "Sonatel", exchange: "BRVM", kind: "company", sector: "Télécoms" }),
    entry({ symbol: "BRVM_COMPOSITE", name: "BRVM Composite", exchange: "BRVM", kind: "index" }),
    entry({ symbol: "MTNN", name: "MTN Nigeria", exchange: "NGX", kind: "company", sector: "Télécoms" }),
  ];

  it("filtre sans tenir compte des accents ni de la casse", () => {
    expect(filterChartCatalog(list, "TELECOM").map((e) => e.symbol)).toEqual(["SNTS", "MTNN"]);
    expect(filterChartCatalog(list, "composite").map((e) => e.symbol)).toEqual(["BRVM_COMPOSITE"]);
  });

  it("accepte le code d'indice avec espaces à la place des underscores", () => {
    expect(filterChartCatalog(list, "brvm composite").map((e) => e.symbol)).toEqual([
      "BRVM_COMPOSITE",
    ]);
  });

  it("renvoie tout si la recherche est vide", () => {
    expect(filterChartCatalog(list, "  ")).toHaveLength(3);
  });
});

describe("hiddenCatalogCounts", () => {
  it("compte les valeurs actives sans historique de cours", () => {
    expect(
      hiddenCatalogCounts({ companies: 50, indices: 12 }, { companies: 47, indices: 10 })
    ).toEqual({ hiddenCompanies: 3, hiddenIndices: 2 });
  });

  it("ne descend pas sous zéro", () => {
    expect(hiddenCatalogCounts({ companies: 1, indices: 0 }, { companies: 2, indices: 0 })).toEqual({
      hiddenCompanies: 0,
      hiddenIndices: 0,
    });
  });
});
