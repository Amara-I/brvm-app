import { describe, expect, it } from "vitest";
import { buildNgxListedCompanies, filterNgxListedRows } from "./ngx-listed-companies";

const mtnnMeta = {
  ngxFundamentals: { sharesOutstanding: { value: 20_000_000_000 } },
};

const companies = [
  {
    ticker: "DANGCEM",
    name: "Dangote Cement",
    sectorSlug: "industrials",
    sectorName: "Industrials",
    profileMeta: { ngxFundamentals: { sharesOutstanding: { value: 16_000_000_000 } } },
  },
  {
    ticker: "MTNN",
    name: "MTN Nigeria",
    sectorSlug: "telecoms",
    sectorName: "Telecoms",
    profileMeta: mtnnMeta,
  },
  {
    ticker: "NEWCO",
    name: "New Listing Plc",
    sectorSlug: "telecoms",
    sectorName: "Telecoms",
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
    expect(data.sectors.map((s) => s.slug)).toEqual(["industrials", "telecoms"]);
    expect(data.sectors.find((s) => s.slug === "telecoms")?.count).toBe(2);

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
    expect(filterNgxListedRows(rows, "", "telecoms").map((r) => r.ticker)).toEqual(["MTNN", "NEWCO"]);
    expect(filterNgxListedRows(rows, "mtn", "").map((r) => r.ticker)).toEqual(["MTNN"]);
    expect(filterNgxListedRows(rows, "listing", "telecoms").map((r) => r.ticker)).toEqual(["NEWCO"]);
    expect(filterNgxListedRows(rows, "mtn", "industrials")).toEqual([]);
  });
});
