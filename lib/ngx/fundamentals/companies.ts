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
  // Extension : sociétés du top-50 (capitalisation NGX) ajoutées après le premier lot.
  c("AIRTELAFRI", "Airtel Africa Plc", "corporate", { currency: "USD", fyEndMonth: 3, note: "États consolidés en USD (millions), exercice clos au 31 mars" }),
  c("MTNN", "MTN Nigeria Communications Plc", "corporate"),
  c("BUAFOODS", "BUA Foods Plc", "corporate"),
  c("BUACEMENT", "BUA Cement Plc", "corporate"),
  c("ARADEL", "Aradel Holdings Plc", "corporate"),
  c("NB", "Nigerian Breweries Plc", "corporate", { unitHints: { 2022: 1000 }, note: "AFS 2022 : montants arrondis au millier (« nearest thousand »), unité absente de l'en-tête" }),
  c("GEREGU", "Geregu Power Plc", "corporate"),
  c("TRANSPOWER", "Transcorp Power Plc", "corporate"),
  c("UACN", "UAC of Nigeria Plc", "corporate"),
  c("NGXGROUP", "Nigerian Exchange Group Plc", "bank", { symbols: ["NGXGROUP", "NSE"], note: "ex-Nigerian Stock Exchange (NSE)" }),
  c("CUSTODIAN", "Custodian Investment Plc", "insurance"),
  c("UCAP", "United Capital Plc", "bank"),
  c("VITAFOAM", "Vitafoam Nigeria Plc", "corporate", { fyEndMonth: 9, note: "Exercice clos au 30 septembre" }),
  c("PZ", "PZ Cussons Nigeria Plc", "corporate", { fyEndMonth: 5, note: "Exercice clos au 31 mai" }),
  c("FIDSON", "Fidson Healthcare Plc", "corporate"),
  c("ABBEYBANK", "Abbey Mortgage Bank Plc", "bank", { symbols: ["ABBEYBANK", "ABBEYBDS"], note: "ex-Abbey Building Society (ABBEYBDS)" }),
  c("SKYAVN", "Skyway Aviation Handling Company Plc", "corporate"),
  c("MECURE", "Mecure Industries Plc", "corporate"),
  c("TOTAL", "TotalEnergies Marketing Nigeria Plc", "corporate"),
];

export function getCompany(ticker: string): NgxCompanyConfig | undefined {
  return NGX_COMPANIES.find((x) => x.ticker === ticker);
}
