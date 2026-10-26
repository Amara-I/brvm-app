export const legal = {
  metaTitle: "Legal notice — OuestBourse",
  metaDescription:
    "Legal notice, data sources, personal-data protection and financial disclaimer for OuestBourse.",
  title: "Legal notice",
  updated: "Last updated: in line with the rollout of step 9 of the roadmap (see AGENTS.md).",
  origin: {
    title: "Data sources and reliability",
    intro:
      "The financial data shown (closing prices, dividends, ratios) comes from the following sources, in order of reliability when they disagree:",
    brvmName: "BRVM.org",
    brvm:
      " — official source of the Bourse Régionale des Valeurs Mobilières. Used as the primary source of truth for prices, volumes and market capitalisations.",
    sikaName: "Sikafinance.com",
    sika: " — news and market portal, used as a complement for indices and news.",
    richName: "Richbourse.com",
    rich: " — market-information platform, used to cross-check financial ratios.",
    manual: "Manual entry — used only as a fallback if all three automated sources fail at the same time.",
    audit:
      "Any gap above 2% between two sources for the same figure is recorded and reviewed manually. The source and sync timestamp of the retained figure are shown on each listed company’s profile.",
    affiliation:
      "OuestBourse is not affiliated with any of the sources named above; their names are cited to attribute the data, in line with reasonable, non-commercial use of publicly available content.",
  },
  disclaimer: {
    title: "Financial disclaimer",
    p1Before:
      "⚠️ The information, indicators, scores, signals (“BUY”, “HOLD”, “SELL”, and so on) and price projections shown on OuestBourse are provided ",
    p1Emphasis: "for information and education only",
    p1After:
      ". They rely on simple statistical models (linear regression on historical data) and do not take into account the issuer’s news, future market conditions, or the investor’s personal situation.",
    p2: "None of this is investment advice, a recommendation to buy or sell, or a solicitation under the rules applicable in the WAEMU area. Past performance is not a guide to future performance. Investing in a financial market involves the risk of losing capital.",
    p3: "Before any investment decision, consult a licensed financial adviser and refer to the official releases of the listed companies and to BRVM notices.",
  },
  privacy: {
    title: "Personal data protection (GDPR)",
    collectedLabel: "Data we collect",
    collected:
      " — when you create an account: email address, password (hashed, never stored in clear text), name (optional). For the “Portfolio” feature: the positions you enter (company, quantity, purchase price).",
    purposeLabel: "Purpose",
    purpose:
      " — this data is used only to authenticate you and to track a personal portfolio. It is not sold or shared with third parties for commercial purposes.",
    cookiesLabel: "Cookies",
    cookies:
      " — only a session cookie strictly required for authentication is set (NextAuth.js). No audience-measurement or advertising cookie is used today; if that changed, a consent banner would be shown first.",
    analyticsLabel: "First-party usage measurement",
    analytics:
      " — to improve the product, OuestBourse records aggregated usage events (page viewed, feature clicked) in its own database. No email address, name, IP address or form content is stored in those events. An anonymous session identifier (stored in localStorage) is used to estimate distinct visitors. Events are kept for 90 days. If you are signed in, only the account’s internal identifier may be attached to the event, never your email.",
    rightsLabel: "Your rights",
    rights:
      " — under applicable data-protection law, you have the right to access, rectify, erase and port your data. To exercise these rights, or for any question, contact the publisher at the address given in the publisher information below.",
  },
  publisher: {
    title: "Publisher",
    body: "Application developed as an independent financial-analysis project. Contact details are to be completed by the publisher before production release (name, address, contact email, hosting provider).",
  },
} as const;
