import { describe, expect, it } from "vitest";
import { familySortRank, isHeadlineIndex, resolveIndexCatalog } from "./index-catalog";

describe("resolveIndexCatalog", () => {
  it("connaît les indices principaux BRVM", () => {
    expect(resolveIndexCatalog("BRVM_COMPOSITE").compositionKind).toBe("all_listed");
    expect(resolveIndexCatalog("BRVM_30").compositionKind).toBe("unavailable");
    expect(resolveIndexCatalog("BRVM_COMPOSITE").family).toBe("principal");
  });

  it("mappe les sectoriels par libellé sans inventer de pondération", () => {
    const publics = resolveIndexCatalog("BRVM_SERVICES_PUBLICS", "BRVM - SERVICES PUBLICS");
    expect(publics.family).toBe("sectoriel");
    expect(publics.compositionKind).toBe("sector_peers");
    expect(publics.sectorName).toBe("Services Publics");

    const industrie = resolveIndexCatalog("BRVM_INDUSTRIE", "BRVM Industrie");
    expect(industrie.sectorName).toBe("Industrie");
  });

  it("sépare Sika Total Return des indices officiels", () => {
    const sika = resolveIndexCatalog("SIKA_TOTAL_RETURN", "SIKA TOTAL RETURN");
    expect(sika.family).toBe("autre");
    expect(sika.compositionKind).toBe("unavailable");
  });

  it("ne classe pas INDICE SIKAFINANCE comme sectoriel BRVM", () => {
    const sika = resolveIndexCatalog("INDICE_SIKAFINANCE", "INDICE SIKAFINANCE");
    expect(sika.family).toBe("autre");
    expect(sika.compositionKind).toBe("unavailable");
  });

  it("reconnaît Consommation de base malgré le « DE »", () => {
    const base = resolveIndexCatalog("BRVM_CONSOMMATION_DE_BASE", "BRVM - CONSOMMATION DE BASE");
    expect(base.family).toBe("sectoriel");
    expect(base.sectorName).toBe("Conso. Base");
  });

  it("reste honnête sur un code inconnu", () => {
    const unknown = resolveIndexCatalog("XYZ_FOO", "Foo Index");
    expect(unknown.compositionKind).toBe("unavailable");
    expect(unknown.family).toBe("autre");
  });
});

describe("headline / sort", () => {
  it("identifie Composite et BRVM 30", () => {
    expect(isHeadlineIndex("BRVM_COMPOSITE")).toBe(true);
    expect(isHeadlineIndex("BRVM_30")).toBe(true);
    expect(isHeadlineIndex("BRVM_INDUSTRIE")).toBe(false);
  });

  it("ordonne principal < sectoriel < autre", () => {
    expect(familySortRank("principal")).toBeLessThan(familySortRank("sectoriel"));
    expect(familySortRank("sectoriel")).toBeLessThan(familySortRank("autre"));
  });
});
