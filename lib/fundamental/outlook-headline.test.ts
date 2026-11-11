import { describe, expect, it } from "vitest";
import { outlookHeadline } from "./outlook-headline";
import type { OutlookSynthesis } from "@/lib/outlook/synthesis";

const synthesis: OutlookSynthesis = {
  summary: {
    fr: { bullets: ["S1 2026 : CA 1 049,8 Mds FCFA (+9,3 %), résultat net 230 Mds (+10,5 %)."], watch: [] },
    en: { bullets: ["H1 2026: revenue 1,049.8 bn FCFA (+9.3%)."], watch: [] },
  },
  items: [
    {
      type: "guidance",
      textFr: "Objectif de marge inchangé.",
      textEn: "Margin target unchanged.",
      date: "2026-07",
      sourceName: "Rapport",
      url: null,
      confidence: "high",
    },
  ],
  updatedAt: "2026-10-29T07:16:22Z",
};

describe("accroche de perspectives", () => {
  it("reprend la première puce, pas le libellé du verdict", () => {
    const line = outlookHeadline(synthesis, "fr");
    expect(line).toMatch(/^S1 2026/);
    expect(line).not.toBe("Synthèse disponible");
    expect(line!.length).toBeLessThanOrEqual(110);
  });

  it("retombe sur un élément sourcé si la synthèse n'a pas de puce", () => {
    const bare: OutlookSynthesis = {
      ...synthesis,
      summary: { fr: { bullets: [], watch: [] }, en: { bullets: [], watch: [] } },
    };
    expect(outlookHeadline(bare, "en")).toBe("Margin target unchanged.");
  });

  it("reste vide quand rien n'est chargé", () => {
    expect(outlookHeadline(null, "fr")).toBeNull();
  });
});
