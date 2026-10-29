import { describe, expect, it } from "vitest";
import { fixtureSheetInput } from "./__fixtures__";
import { outlookSummary, outlookText, parseNgxOutlook } from "./outlook";
import { buildNgxSheet } from "./sheet-model";

const sample = {
  ngxOutlook: {
    summaryFr: { bullets: ["Croissance visée à 20 %.", "  ", 12], watch: ["Risque de change."] },
    summaryEn: { bullets: ["Growth targeted at 20%."], watch: [] },
    updatedAt: "2026-10-29T06:57:00Z",
    items: [
      {
        type: "analyst",
        textFr: "Achat, objectif 150 ₦.",
        textEn: "Buy, target ₦150.",
        date: "2026-05-14",
        sourceName: "CardinalStone",
        url: "https://example.com/research",
        confidence: "high",
      },
      { type: "risk", textFr: null, textEn: "FX risk.", date: "2026-07", sourceName: "Press", url: "javascript:alert(1)", confidence: "bogus" },
      { type: "unknown", textFr: "ignoré" },
      { type: "project", textFr: "", textEn: "" },
      "not-an-object",
    ],
  },
};

describe("parseNgxOutlook", () => {
  it("retourne null sans clé ngxOutlook ou sans contenu exploitable", () => {
    expect(parseNgxOutlook(null)).toBeNull();
    expect(parseNgxOutlook({})).toBeNull();
    expect(parseNgxOutlook({ ngxFundamentals: {} })).toBeNull();
    expect(parseNgxOutlook({ ngxOutlook: "x" })).toBeNull();
    expect(parseNgxOutlook({ ngxOutlook: { summaryFr: { bullets: [] }, items: [] } })).toBeNull();
  });

  it("nettoie les résumés et les éléments", () => {
    const o = parseNgxOutlook(sample)!;
    expect(o.summary.fr.bullets).toEqual(["Croissance visée à 20 %."]);
    expect(o.summary.fr.watch).toEqual(["Risque de change."]);
    expect(o.items).toHaveLength(2);
    expect(o.items[0]).toMatchObject({ type: "analyst", date: "2026-05-14", confidence: "high", sourceName: "CardinalStone" });
    expect(o.items[0].url).toBe("https://example.com/research");
    expect(o.updatedAt).toBe("2026-10-29T06:57:00Z");
  });

  it("refuse les URL non http(s) et les confiances inconnues", () => {
    const risk = parseNgxOutlook(sample)!.items[1];
    expect(risk.url).toBeNull();
    expect(risk.confidence).toBeNull();
    expect(risk.date).toBe("2026-07");
  });

  it("ignore une date ou un horodatage invalide", () => {
    const o = parseNgxOutlook({
      ngxOutlook: { summaryFr: { bullets: ["a"] }, updatedAt: "hier", items: [{ type: "sector", textFr: "x", date: "bientôt" }] },
    })!;
    expect(o.updatedAt).toBeNull();
    expect(o.items[0].date).toBeNull();
  });

  it("plafonne le nombre d'éléments", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ type: "risk", textFr: `r${i}` }));
    expect(parseNgxOutlook({ ngxOutlook: { items } })!.items).toHaveLength(40);
  });
});

describe("langue d'affichage", () => {
  const o = parseNgxOutlook(sample)!;
  it("choisit la langue demandée avec repli sur l'autre", () => {
    expect(outlookText(o.items[0], "fr")).toBe("Achat, objectif 150 ₦.");
    expect(outlookText(o.items[0], "en")).toBe("Buy, target ₦150.");
    expect(outlookText(o.items[1], "fr")).toBe("FX risk.");
    expect(outlookSummary(o, "en").bullets).toEqual(["Growth targeted at 20%."]);
    expect(outlookSummary(o, "en").watch).toEqual(["Risque de change."]);
  });
});

describe("modèle de la fiche : synthèse des perspectives", () => {
  it("est null quand profile_meta n'a pas ngxOutlook (état vide)", () => {
    expect(buildNgxSheet(fixtureSheetInput()).outlook.synthesis).toBeNull();
  });

  it("charge la synthèse depuis profile_meta sans toucher aux fondamentaux", () => {
    const base = fixtureSheetInput();
    const company = base.company;
    const withOutlook = {
      ...base,
      company: { ...company, profileMeta: { ...(company.profileMeta as object), ...sample } },
    };
    const model = buildNgxSheet(withOutlook);
    expect(model.outlook.synthesis?.items).toHaveLength(2);
    expect(model.presentation.shares).toEqual(buildNgxSheet(base).presentation.shares);
    expect(model.outlook.guidance).toHaveLength(buildNgxSheet(base).outlook.guidance.length);
  });
});
