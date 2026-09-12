import { describe, expect, it } from "vitest";
import { AFRICAN_EXCHANGES } from "./african-exchanges";
import {
  BRVM_NAV_HREFS,
  GLOBAL_NAV_HREFS,
  comingSoonExchanges,
  isBrvmNavPath,
  isGlobalNavPath,
} from "./nav-structure";

describe("isBrvmNavPath", () => {
  it("reconnaît les anciennes pages du groupe Marché", () => {
    for (const href of BRVM_NAV_HREFS) {
      expect(isBrvmNavPath(href)).toBe(true);
    }
  });

  it("reconnaît les fiches sociétés BRVM", () => {
    expect(isBrvmNavPath("/actions/SNTS")).toBe(true);
    expect(isBrvmNavPath("/actions")).toBe(true);
  });

  it("ne range pas les pages globales sous BRVM", () => {
    for (const href of GLOBAL_NAV_HREFS) {
      expect(isBrvmNavPath(href)).toBe(false);
    }
    expect(isBrvmNavPath("/outils")).toBe(false);
    expect(isBrvmNavPath("/actualites")).toBe(false);
    expect(isBrvmNavPath("/education")).toBe(false);
    expect(isBrvmNavPath("/connexion")).toBe(false);
  });

  it("ignore un pathname vide", () => {
    expect(isBrvmNavPath(null)).toBe(false);
    expect(isBrvmNavPath(undefined)).toBe(false);
    expect(isBrvmNavPath("")).toBe(false);
  });
});

describe("isGlobalNavPath", () => {
  it("identifie Portefeuille et Simulation", () => {
    expect(isGlobalNavPath("/portefeuille")).toBe(true);
    expect(isGlobalNavPath("/simulation")).toBe(true);
    expect(isGlobalNavPath("/portefeuille/demo")).toBe(true);
  });

  it("ne prend pas les pages BRVM pour globales", () => {
    expect(isGlobalNavPath("/marche")).toBe(false);
    expect(isGlobalNavPath("/screener")).toBe(false);
  });
});

describe("comingSoonExchanges", () => {
  it("liste les mêmes places « bientôt » que les pastilles du marché", () => {
    const codes = comingSoonExchanges().map((e) => e.code);
    expect(codes).toEqual(["BVMAC", "NGX", "NSE", "JSE", "GSE", "TSE"]);
    expect(codes).not.toContain("BRVM");
    expect(AFRICAN_EXCHANGES.filter((e) => e.live).map((e) => e.code)).toEqual(["BRVM"]);
  });
});
