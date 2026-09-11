import { describe, expect, it } from "vitest";
import { COMPANIES_FULL } from "@/prisma/seed-data/companies-full";
import { seedCompaniesFullDataset, seedCompaniesNavIndex } from "./offline-seed-dataset";

describe("offline seed dataset", () => {
  it("fournit toutes les sociétés du seed pour l'affichage local", () => {
    const ds = seedCompaniesFullDataset();
    expect(ds.companies.length).toBe(COMPANIES_FULL.length);
    expect(ds.years.length).toBeGreaterThan(0);
    const snts = ds.companies.find((c) => c.ticker === "SNTS");
    expect(snts?.name).toBe("Sonatel");
    expect(snts?.dataSource).toBe("MANUEL");
    expect((snts?.prices[2026] ?? 0) > 0).toBe(true);
  });

  it("regroupe le méga-menu par secteur", () => {
    const nav = seedCompaniesNavIndex();
    expect(nav.companies.length).toBe(COMPANIES_FULL.length);
    expect(nav.sectorGroups.length).toBeGreaterThan(1);
    expect(nav.sectorGroups.every((g) => g.companies.length > 0)).toBe(true);
  });
});
