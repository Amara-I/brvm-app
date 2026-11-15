import { describe, expect, it } from "vitest";
import { buildNgxListedCompanies, filterNgxListedRows } from "./ngx-listed-companies";
import { groupNgxListedRows } from "./ngx-listed-companies-core";
import { ngxCompanyDisplayName } from "@/lib/ngx/official-names";
import { ngxSectorGroup } from "@/lib/ngx/sectors";

const mtnnMeta = {
  ngxFundamentals: { sharesOutstanding: { value: 20_000_000_000 } },
};

const companies = [
  {
    ticker: "DANGCEM",
    name: "Dangote Cement",
    sectorSlug: "industrial-goods",
    sectorName: "Industrial Goods",
    profileMeta: { ngxFundamentals: { sharesOutstanding: { value: 16_000_000_000 } } },
  },
  {
    ticker: "MTNN",
    name: "MTN Nigeria",
    sectorSlug: "ict",
    sectorName: "ICT",
    profileMeta: mtnnMeta,
  },
  {
    ticker: "NEWCO",
    name: "New Listing Plc",
    sectorSlug: "ict",
    sectorName: "ICT",
    profileMeta: null,
  },
];

const quotes = [
  { ticker: "MTNN", close: 250, changePercent: 1.5, date: "2026-11-14" },
  { ticker: "DANGCEM", close: 500, changePercent: -0.8, date: "2026-11-13" },
];

describe("buildNgxListedCompanies", () => {
  it("assemble cours, variation et capitalisation, et laisse N/D si les titres manquent", () => {
    const data = buildNgxListedCompanies(companies, quotes);
    expect(data.rows).toHaveLength(3);
    expect(data.sessionDate).toBe("2026-11-14");
    expect(data.sectors.map((s) => s.slug)).toEqual(["industrial-goods", "ict"]);
    expect(data.sectors.find((s) => s.slug === "ict")?.count).toBe(2);

    const mtnn = data.rows.find((r) => r.ticker === "MTNN");
    expect(mtnn).toMatchObject({ close: 250, changePercent: 1.5, sessionDate: "2026-11-14" });
    expect(mtnn?.marketCapBn).toBe(5000);

    const dang = data.rows.find((r) => r.ticker === "DANGCEM");
    expect(dang?.marketCapBn).toBe(8000);

    const newbie = data.rows.find((r) => r.ticker === "NEWCO");
    expect(newbie).toMatchObject({ close: null, changePercent: null, marketCapBn: null, sessionDate: null });

    expect(data.totalCapBn).toBe(13000);
  });

  it("n'invente pas de cours : une société sans cotation reste à N/D", () => {
    const data = buildNgxListedCompanies(companies.slice(2), []);
    expect(data.rows[0]).toMatchObject({ ticker: "NEWCO", close: null, marketCapBn: null });
    expect(data.totalCapBn).toBeNull();
    expect(data.sessionDate).toBeNull();
  });
});

describe("filterNgxListedRows", () => {
  const rows = buildNgxListedCompanies(companies, quotes).rows;

  it("filtre par secteur et par recherche ticker/nom", () => {
    expect(filterNgxListedRows(rows, "", "ict").map((r) => r.ticker)).toEqual(["MTNN", "NEWCO"]);
    expect(filterNgxListedRows(rows, "mtn", "").map((r) => r.ticker)).toEqual(["MTNN"]);
    expect(filterNgxListedRows(rows, "listing", "ict").map((r) => r.ticker)).toEqual(["NEWCO"]);
    expect(filterNgxListedRows(rows, "mtn", "industrial-goods")).toEqual([]);
  });
});

describe("noms et catégories NGX", () => {
  it("affiche le nom officiel et retire les suffixes de compartiment", () => {
    expect(ngxCompanyDisplayName("ACCESSCORP", "ACCESSCORP [MRF]")).toBe("ACCESS HOLDINGS PLC");
    expect(ngxCompanyDisplayName("UNKNOWNX", "FOO [BMF]")).toBe("FOO");
  });

  it("sépare banques, assureurs et autres financiers", () => {
    expect(ngxSectorGroup("INFINITY", "financial-services")).toBe("BANKING");
    expect(ngxSectorGroup("UCAP", "financial-services")).toBe("FINANCIAL_SERVICES");
    expect(ngxSectorGroup("GEREGU", "utilities")).toBe("UTILITIES");
  });

  it("regroupe les lignes dans l'ordre des familles", () => {
    const financials = [
      { ticker: "GTCO", name: "GTCO", sectorSlug: "financial-services", sectorName: "Financial Services", profileMeta: mtnnMeta },
      { ticker: "UCAP", name: "UCAP", sectorSlug: "financial-services", sectorName: "Financial Services", profileMeta: mtnnMeta },
      { ticker: "AIICO", name: "AIICO", sectorSlug: "financial-services", sectorName: "Financial Services", profileMeta: mtnnMeta },
    ];
    const quotes = financials.map((c) => ({ ticker: c.ticker, close: 10, changePercent: 0, date: "2026-11-14" }));
    const sections = groupNgxListedRows(buildNgxListedCompanies(financials, quotes).rows);
    expect(sections.map((s) => s.slug)).toEqual(["banking", "insurance", "financial-services"]);
  });
});
