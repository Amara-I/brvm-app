import type { NgxCompanyConfig } from "./types";

// Périmètre PR 2 : les 29 sociétés du top-40 (capitalisation) avec 10 exercices 2016-2025
// disponibles dans la liste NGX. Surcharges par société : type d'états (banque…), devise,
// clôture, symboles historiques.
const c = (
  ticker: string,
  name: string,
  kind: NgxCompanyConfig["kind"],
  extra: Partial<NgxCompanyConfig> = {},
): NgxCompanyConfig => ({
  ticker,
  name,
  kind,
  symbols: [ticker],
  currency: "NGN",
  fyEndMonth: 12,
  ...extra,
});

export const NGX_COMPANIES: NgxCompanyConfig[] = [
  c("DANGCEM", "Dangote Cement Plc", "corporate"),
  c("SEPLAT", "Seplat Energy Plc", "corporate", {
    note: "Présente ₦ et $ côte à côte ; la colonne ₦ est retenue",
  }),
  c("FIRSTHOLDCO", "FirstHoldCo Plc", "bank", { symbols: ["FIRSTHOLDCO", "FBNH"], note: "ex-FBN Holdings (FBNH)" }),
  c("HBMNG", "Holcim/Lafarge Africa Plc", "corporate", { symbols: ["HBMNG", "WAPCO"], note: "ex-Lafarge Africa / WAPCO" }),
  c("ZENITHBANK", "Zenith Bank Plc", "bank"),
  c("GTCO", "Guaranty Trust Holding Co Plc", "bank", { symbols: ["GTCO", "GUARANTY"], note: "ex-GUARANTY (GTBank)" }),
  c("TRANSCOHOT", "Transcorp Hotels Plc", "corporate"),
  c("STANBIC", "Stanbic IBTC Holdings Plc", "bank"),
  c("NESTLE", "Nestlé Nigeria Plc", "corporate"),
  c("PRESCO", "Presco Plc", "corporate"),
  c("UBA", "United Bank for Africa Plc", "bank"),
  c("INTBREW", "International Breweries Plc", "corporate"),
  c("ACCESSCORP", "Access Holdings Plc", "bank", { symbols: ["ACCESSCORP", "ACCESS"], note: "ex-Access Bank (ACCESS)" }),
  c("FIDELITYBK", "Fidelity Bank Plc", "bank"),
  c("DANGSUGAR", "Dangote Sugar Refinery Plc", "corporate"),
  c("WEMABANK", "Wema Bank Plc", "bank"),
  c("OKOMUOIL", "Okomu Oil Palm Plc", "corporate"),
  c("ETI", "Ecobank Transnational Inc.", "bank", { currency: "USD", note: "États en USD (millions)" }),
  c("GUINNESS", "Guinness Nigeria Plc", "corporate", { fyEndMonth: 6, note: "Exercice clos au 30 juin pour les premiers états (à confirmer document par document)" }),
  c("FCMB", "FCMB Group Plc", "bank"),
  c("UNILEVER", "Unilever Nigeria Plc", "corporate"),
  c("STERLINGNG", "Sterling Financial Holdings Co Plc", "bank", { symbols: ["STERLINGNG", "STERLNBANK"], note: "ex-Sterling Bank (STERLNBANK)" }),
  c("JBERGER", "Julius Berger Nigeria Plc", "corporate"),
  c("NASCON", "NASCON Allied Industries Plc", "corporate"),
  c("OANDO", "Oando Plc", "corporate"),
  c("JAIZBANK", "Jaiz Bank Plc", "bank"),
  c("NAHCO", "NAHCO Aviance Plc", "corporate"),
  c("TRANSCORP", "Transnational Corporation Plc", "corporate"),
  c("BETAGLAS", "Beta Glass Plc", "corporate"),
];

export function getCompany(ticker: string): NgxCompanyConfig | undefined {
  return NGX_COMPANIES.find((x) => x.ticker === ticker);
}
