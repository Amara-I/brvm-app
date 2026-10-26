export const directory = {
  companies: {
    metaTitle: "Listed companies — OuestBourse",
    metaDescription:
      "BRVM listed companies grouped by sector, with price, market capitalisation and analysis signals.",
    eyebrow: "The BRVM market",
    title: "Listed companies",
    leadBefore: "All issuers covered on the ",
    leadMid: " (Regional Securities Exchange, WAEMU). Companies are grouped by ",
    leadSector: "sector",
    leadAfter:
      " so peers are easier to compare. Each profile sets out the analysis signal, the history and the projections.",
    issuers: "{count} issuers",
    sectors: "{count} sectors",
    countries: "{count} countries",
    history: "History {span}",
    tocAria: "Sector groups",
    tocLabel: "Jump to a sector",
    capReported: "Reported market cap: {amount} ({withCap}/{total})",
    capReportedNd: "Reported market cap: N/D",
    price: "Price",
    mktCap: "Market cap",
    mktCapShort: "{amount} bn",
    dividendYield: "Div. yield",
    score: "Score",
    sheet: "Profile →",
    fullSheet: "Full profile & analysis →",
    note: "Sources: canonical BRVM / Sikafinance / Richbourse data reconciled in the database. Missing market caps or P/E ratios are shown as “N/D”. Information only — this is not investment advice.",
    legalLink: "Legal notice",
    sectorsBlurb: {
      banques:
        "WAEMU banks listed on the BRVM: lending, deposit-taking and financial services. Often followed for dividend yield and balance-sheet strength.",
      consoBase:
        "Everyday consumer goods (food, beverages, hygiene products). Demand is relatively steady, and the names are often watched for the recurrence of earnings.",
      consoDiscretionnaire:
        "Non-essential goods and services (retail, equipment, leisure). More sensitive to the economic cycle and to household purchasing power.",
      divertissement:
        "Media, leisure and entertainment businesses listed on the exchange. A small BRVM universe — each name should be read on its own.",
      energie:
        "Energy producers and distributors (hydrocarbons, gas and related services). Sensitive to commodity prices and to national regulation.",
      industrie:
        "Manufacturing and processing. Performance is tied to productive investment, input costs and regional demand.",
      servicesPublics:
        "Services of general interest (water, electricity, infrastructure). Often a defensive profile, with a large regulatory component.",
      telecoms:
        "Telecommunications operators. A large weight in BRVM indices, followed for subscriber growth, cash flow and dividend policy.",
      autres:
        "Companies whose official sector does not fit the groups above, or whose classification in the database is still partial.",
      fallback:
        "Companies classified in the “{sector}” sector under the taxonomy stored in the database (BRVM / Richbourse sources).",
    },
    recapDividend: "Dividend: yield {yield}% · P/E {per}",
    recapRisk: "Risk: {tier} ({score}/100){vol}",
    recapVol: " · volatility {vol}%",
    recapHorizons: "Horizons S/M/L: {court} / {moyen} / {long} · fund. {fundamental}/100",
  },
  news: {
    metaTitle: "News — OuestBourse",
    metaDescription: "BRVM market news aggregated from official and partner sources.",
    kicker: "Market watch",
    title: "News",
    lead: "The BRVM market in brief, aggregated from official BRVM, Sikafinance and Richbourse.",
    emptyTitle: "No news for now",
    emptyBody:
      "Automatic news ingestion is not enabled yet. As soon as the official and partner sources feed the stream, headlines will appear here — nothing is invented in the meantime.",
  },
} as const;
