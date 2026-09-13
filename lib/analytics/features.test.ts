import { describe, expect, it } from "vitest";
import { featureFromPath, featureLabel, shouldTrackPath } from "./features";

describe("featureFromPath", () => {
  it("associe les routes produit aux fonctionnalités", () => {
    expect(featureFromPath("/")).toBe("landing");
    expect(featureFromPath("/marche")).toBe("marche");
    expect(featureFromPath("/indices/BRVMC")).toBe("indices");
    expect(featureFromPath("/screener")).toBe("screener");
    expect(featureFromPath("/graphes")).toBe("graphes");
    expect(featureFromPath("/portefeuille")).toBe("portefeuille");
    expect(featureFromPath("/simulation")).toBe("simulation");
    expect(featureFromPath("/actions/SNTS")).toBe("company_sheet");
    expect(featureFromPath("/societes-cotees")).toBe("societes_cotees");
    expect(featureFromPath("/marches/jse")).toBe("coming_soon_market");
    expect(featureFromPath("/calendrier-dividendes")).toBe("dividendes");
    expect(featureFromPath("/education/introduire")).toBe("education");
    expect(featureFromPath("/notifications")).toBe("notifications");
    expect(featureFromPath("/profil")).toBe("profil");
    expect(featureFromPath("/reglages")).toBe("profil");
  });

  it("retombe sur other pour une route inconnue", () => {
    expect(featureFromPath("/inconnu")).toBe("other");
  });
});

describe("shouldTrackPath", () => {
  it("ignore admin et API", () => {
    expect(shouldTrackPath("/admin/analytics")).toBe(false);
    expect(shouldTrackPath("/api/analytics/events")).toBe(false);
    expect(shouldTrackPath("/screener")).toBe(true);
  });
});

describe("featureLabel", () => {
  it("expose les libellés français", () => {
    expect(featureLabel("screener")).toBe("Screener");
    expect(featureLabel("coming_soon_market")).toBe("Marchés bientôt");
    expect(featureLabel("inconnu")).toBe("inconnu");
  });
});
