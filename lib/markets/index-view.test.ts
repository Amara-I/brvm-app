import { describe, expect, it } from "vitest";
import {
  buildIndexComposition,
  groupIndicesByFamily,
  sortIndexItems,
  type MarketIndexListItem,
} from "./index-view";

describe("buildIndexComposition", () => {
  const companies = [
    { ticker: "SNTS", name: "Sonatel", sector: "Télécoms", lastPrice: 32000 },
    { ticker: "SGBC", name: "SGBC", sector: "Banques", lastPrice: 39000 },
    { ticker: "SICC", name: "SICC", sector: "Services Publics", lastPrice: null },
  ];

  it("liste toutes les sociétés pour le Composite", () => {
    const composition = buildIndexComposition("all_listed", undefined, companies);
    expect(composition.constituents).toHaveLength(3);
    expect(composition.note).toMatch(/Pondérations officielles N\/D/);
  });

  it("filtre le secteur sans inventer de poids", () => {
    const composition = buildIndexComposition("sector_peers", "Banques", companies);
    expect(composition.constituents.map((c) => c.ticker)).toEqual(["SGBC"]);
    expect(composition.note).toMatch(/pas la composition officielle/);
  });

  it("reste vide si la composition officielle est inconnue", () => {
    const composition = buildIndexComposition("unavailable", undefined, companies);
    expect(composition.constituents).toEqual([]);
    expect(composition.note).toMatch(/non disponible/);
  });
});

describe("groupIndicesByFamily", () => {
  it("ordonne principal puis sectoriel", () => {
    const items = sortIndexItems([
      {
        code: "BRVM_INDUSTRIE",
        name: "BRVM Industrie",
        family: "sectoriel",
        familyLabel: "Sectoriels",
        description: "",
        lastValue: 1,
        changePercent: null,
        date: "2026-09-10",
        source: "BRVM_OFFICIEL",
        sourceLabel: "BRVM officiel",
        historyPoints: 2,
      },
      {
        code: "BRVM_30",
        name: "BRVM 30",
        family: "principal",
        familyLabel: "Principaux",
        description: "",
        lastValue: 267,
        changePercent: 0.3,
        date: "2026-09-10",
        source: "BRVM_OFFICIEL",
        sourceLabel: "BRVM officiel",
        historyPoints: 4,
      },
      {
        code: "BRVM_COMPOSITE",
        name: "BRVM Composite",
        family: "principal",
        familyLabel: "Principaux",
        description: "",
        lastValue: 552,
        changePercent: 0.18,
        date: "2026-09-10",
        source: "BRVM_OFFICIEL",
        sourceLabel: "BRVM officiel",
        historyPoints: 8,
      },
    ] satisfies MarketIndexListItem[]);

    expect(items.map((i) => i.code)).toEqual(["BRVM_COMPOSITE", "BRVM_30", "BRVM_INDUSTRIE"]);
    expect(groupIndicesByFamily(items).map((g) => g.family)).toEqual(["principal", "sectoriel"]);
  });
});
