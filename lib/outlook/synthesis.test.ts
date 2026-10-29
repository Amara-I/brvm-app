import { describe, expect, it } from "vitest";
import { outlookSummary, outlookText, parseOutlook } from "./synthesis";

const sample = {
  brvmOutlook: {
    summaryFr: { bullets: ["Capex 2026 : 150 Mds FCFA.", "  ", 7], watch: ["Taxe IRVM."] },
    summaryEn: { bullets: [], watch: [] },
    updatedAt: "2026-10-29T08:00:00Z",
    items: [
      { type: "analyst", textFr: "Achat, objectif 25 000 FCFA.", textEn: "Buy, target 25,000 FCFA.", date: "2026-05-14", sourceName: "Hudson & Cie", url: "https://example.com/n", confidence: "high" },
      { type: "risk", textFr: null, textEn: "Tax risk.", date: "2026-07", sourceName: "Press", url: "javascript:alert(1)", confidence: "bogus" },
      { type: "weird", textFr: "ignoré" },
      { type: "project", textFr: "", textEn: "" },
      "not-an-object",
    ],
  },
  ngxOutlook: { summaryFr: { bullets: ["autre marché"], watch: [] }, items: [] },
};

describe("parseOutlook", () => {
  it("lit uniquement la clé demandée", () => {
    const s = parseOutlook(sample, "brvmOutlook");
    expect(s?.summary.fr.bullets).toEqual(["Capex 2026 : 150 Mds FCFA."]);
    expect(parseOutlook(sample, "ngxOutlook")?.summary.fr.bullets).toEqual(["autre marché"]);
    expect(parseOutlook(sample, "absent")).toBeNull();
  });

  it("ignore les éléments invalides et assainit les champs", () => {
    const s = parseOutlook(sample, "brvmOutlook")!;
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ type: "risk", textFr: null, url: null, confidence: null, date: "2026-07" });
    expect(s.updatedAt).toBe("2026-10-29T08:00:00Z");
  });

  it("retourne null sans contenu exploitable", () => {
    expect(parseOutlook(null, "brvmOutlook")).toBeNull();
    expect(parseOutlook({ brvmOutlook: { items: [] } }, "brvmOutlook")).toBeNull();
    expect(parseOutlook({ brvmOutlook: "x" }, "brvmOutlook")).toBeNull();
  });

  it("se replie sur l'autre langue", () => {
    const s = parseOutlook(sample, "brvmOutlook")!;
    expect(outlookSummary(s, "en").bullets).toEqual(["Capex 2026 : 150 Mds FCFA."]);
    expect(outlookText(s.items[1], "fr")).toBe("Tax risk.");
    expect(outlookText(s.items[0], "en")).toBe("Buy, target 25,000 FCFA.");
  });
});
