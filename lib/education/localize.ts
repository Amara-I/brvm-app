// English overlay for the education catalog. French objects are returned
// unchanged. Untranslated articles keep their French fields.

import type { Locale } from "@/lib/i18n/config";
import {
  EDUCATION_CATEGORIES,
  EDUCATION_LEVEL_LABELS,
  EDUCATION_THEMES,
  getAllEducationTerms,
  type EducationCategory,
  type EducationLevel,
  type EducationTerm,
  type EducationTheme,
} from "./catalog";
import { foldEducationQuery, rankEducationSearch, type EducationSearchHit } from "./search";

type TermCopy = {
  title: string;
  definition: string;
  details?: string;
  example: string;
  tip: string | null;
  synonyms?: string[];
};

const EN_LEVELS: Record<EducationLevel, string> = {
  debutant: "Beginner",
  intermediaire: "Intermediate",
  avance: "Advanced",
};

const EN_CATEGORIES: Record<string, Pick<EducationCategory, "title" | "blurb">> = {
  bases: {
    title: "Basics",
    blurb: "The essential vocabulary for reading a market and a company profile.",
  },
  analyse: {
    title: "Analysis",
    blurb: "Why and how to analyse a share: fundamentals, valuation, and technicals adapted to the BRVM.",
  },
  risques: {
    title: "Risks",
    blurb: "Liquidity, volatility, position size and measures for reading risk without understating it.",
  },
  application: {
    title: "In the product",
    blurb: "Where to find things in OuestBourse: menus, signals, charts and the portfolio.",
  },
};

const EN_THEMES: Record<string, Pick<EducationTheme, "title" | "blurb">> = {
  marche: {
    title: "Market & trading",
    blurb: "Exchange, securities, prices, indices and how the BRVM / WAEMU works.",
  },
  rendement: {
    title: "Dividends & yield",
    blurb: "Dividends and yield for the shareholder.",
  },
  "pourquoi-analyser": {
    title: "Why analyse",
    blurb: "Goals, limits and pitfalls of an analysis — without investment advice.",
  },
  "comment-analyser": {
    title: "How to analyse",
    blurb: "A step-by-step path: context, fundamentals, valuation, technicals, signal.",
  },
  fondamentale: {
    title: "Fundamental analysis",
    blurb: "Accounts, margins, EPS and how to read results.",
  },
  valorisation: {
    title: "Valuation",
    blurb: "P/E, market capitalisation and valuation models.",
  },
  rentabilite: {
    title: "Profitability",
    blurb: "ROE, ROIC and return on capital.",
  },
  technique: {
    title: "Technicals adapted to the BRVM",
    blurb: "Moving averages, RSI, MACD, Bollinger, candlesticks — indicators that are useful on liquid series.",
  },
  "technique-avancee": {
    title: "Advanced indicators (poorly suited)",
    blurb: "Ichimoku, Elliott, Fibonacci, ADX, Stochastic, Williams %R, CCI — use with care on the BRVM.",
  },
  strategies: {
    title: "Strategies",
    blurb: "Portfolio, leverage and investment postures.",
  },
  "types-de-portefeuille": {
    title: "Portfolio types",
    blurb:
      "Growth, Income, Trading and Max Growth: objectives, selection grids, teaching allocations and shared BRVM rules.",
  },
  risques: {
    title: "Risk measures",
    blurb: "Liquidity, volatility, VaR, drawdown and how to read risk.",
  },
  "taille-position": {
    title: "Position size",
    blurb:
      "Size a BRVM position from an acceptable loss, the entry price and the stop — formula, examples and a warning.",
  },
  "navigation-app": {
    title: "Menus & navigation",
    blurb: "Where to click: Home, Market, Screener, Charts, profiles, Portfolio, Alerts.",
  },
  plateforme: {
    title: "OuestBourse signals & data",
    blurb: "Signals, scores, N/D, sources and the platform’s tools.",
  },
  "portefeuille-suivi": {
    title: "Portfolio & tracking",
    blurb: "Average cost, unrealised gain, YTD, sector allocation and guidance on your positions.",
  },
};

const EN_TERMS: Record<string, TermCopy> = {
  action: {
    title: "Share",
    definition:
      "A security representing a fraction of a company’s capital, which may carry a right to a dividend and to a vote.",
    details: [
      "A share is a portion of a company’s capital. By holding it you become a shareholder: you may receive a dividend if the general meeting decides so, and you may sometimes exercise a voting right.",
      "On the BRVM, each listed name (for example SNTS, SGBC) trades through an SGI. The price reflects that day’s supply and demand, not a guaranteed “true value”.",
      "On OuestBourse, the company profile brings together price, history, ratios and the signal so you can read a share without confusing price and fundamentals.",
    ].join("\n\n"),
    example:
      "On OuestBourse, open the SNTS (Sonatel) profile: the price, the signal and the history illustrate what a share listed on the BRVM is.",
    synonyms: ["Security", "Equity"],
    tip: "Read the company’s profile and its financial statements before any decision.",
  },
  dividende: {
    title: "Dividend",
    definition: "The portion of profit distributed to shareholders, as decided by the general meeting.",
    details: [
      "The dividend is the share of profit (or reserves) that a company distributes to its shareholders. It is never automatic: the general meeting decides the amount and the timetable.",
      "On the BRVM, ex-dividend and payment dates are published by the issuer and relayed by the exchange. A high dividend does not mean a “safer” company.",
      "OuestBourse shows yields and calendars from the data it has; always check official notices before counting on a payment.",
    ].join("\n\n"),
    example:
      "The OuestBourse dividend calendar lists ex-dates and amounts (for example ETIT, SNTS) — always checked against official sources.",
    synonyms: ["Distribution", "Shareholder income"],
    tip: "A dividend is never guaranteed: it depends on results and on the company’s decision.",
  },
  "rendement-du-dividende": {
    title: "Dividend yield",
    definition: "The annual dividend per share divided by the share price.",
    details: [
      "Dividend yield = annual dividend per share / price. It expresses the income distributed relative to the price paid (excluding any capital gain).",
      "A high yield can come from a generous dividend… or from a fall in the price. Check that it recurs and that earnings cover it.",
      "On OuestBourse, yield feeds the screener and the score; extremes are capped to limit misleading signals.",
    ].join("\n\n"),
    example: "The screener’s yield column and a key input of the fundamental score (capped to avoid extremes).",
    synonyms: ["Dividend yield", "Yield at the price", "Div. yield"],
    tip: "A high yield can reflect a fallen price or a one-off dividend.",
  },
  "per-price-earnings-ratio": {
    title: "P/E (price/earnings ratio)",
    definition: "The share price divided by earnings per share.",
    details: [
      "The P/E (price/earnings) divides the share price by earnings per share. It says how much the market pays for one unit of earnings.",
      "A low P/E can reflect a discount… or weak prospects / high risk. A high P/E can reflect expected growth or overvaluation.",
      "On OuestBourse, the P/E feeds the fundamental score; extremes are flagged as factors to examine, not as automatic verdicts.",
    ].join("\n\n"),
    example:
      "In the screener and on the profile, the P/E feeds the fundamental score: an extreme P/E is flagged as a negative factor.",
    synonyms: ["P/E", "Earnings multiple", "PER"],
    tip: "A low P/E can signal a discount, but also weaker prospects or higher risk.",
  },
  "capitalisation-boursiere": {
    title: "Market capitalisation",
    definition: "A company’s market value: price multiplied by the number of shares.",
    details: [
      "Market capitalisation = price × number of shares. It estimates the company’s market value as the market prices it at a given moment.",
      "It moves with the price and, on its own, does not measure intrinsic value, net debt or the liquidity of the free float.",
      "On OuestBourse, a market cap missing from the database is shown as N/D (never invented). Compare similar sizes within the same BRVM sector.",
    ].join("\n\n"),
    example: "Shown in bn FCFA on profiles; 0 in the database is displayed as N/D (never invented).",
    synonyms: ["Market cap", "Market value"],
    tip: "It moves with the price and does not directly measure intrinsic value.",
  },
  "indice-boursier": {
    title: "Stock index",
    definition: "A statistical indicator measuring the move of a basket of securities under a given method.",
    details: [
      "A stock index summarises the move of a basket of securities under a method (weighting, base, composition). It is a thermometer for the market or a sector.",
      "On the BRVM, indices (Composite, sector indices, and so on) let you place a share or a portfolio against a benchmark, without replacing security-by-security analysis.",
      "Always check composition and calculation rules: two “BRVM” indices do not necessarily measure the same thing.",
    ].join("\n\n"),
    example: "An investor compares portfolio performance with a BRVM benchmark index.",
    synonyms: ["Benchmark", "Market index"],
    tip: "Always check the index composition, weighting and base date.",
  },
  cours: {
    title: "Price",
    definition:
      "The price at which a security trades at a moment or in a given session. The “current price” shown on OuestBourse is the latest canonical close (often the official BRVM print).",
    details: [
      "The price is the level at which a security trades at a moment or in a session. It comes from the meeting of orders, not from an accounting formula.",
      "On the BRVM, the official closing price is often the reference for analysis and publications. A displayed price is not a guarantee of execution at that same price.",
      "OuestBourse prefers canonical prices (often the BRVM source) after multi-source reconciliation, and shows N/D when the figure is missing.",
    ].join("\n\n"),
    example:
      "On /marche and on each company profile, the price shown is the latest canonical price (often the official BRVM print after ingestion).",
    synonyms: ["Quote", "Last price", "Current price"],
    tip: "A displayed price is not necessarily the price at which an order will be filled.",
  },
  "signal-ouestbourse": {
    title: "Investment signal (OuestBourse)",
    definition:
      "A summary label shown on the platform, derived from a composite score (technical, fundamental, risk). The labels are fixed: ACHAT FORT, ACHAT, CONSERVER, ALLÉGER, VENDRE.",
    details:
      "The OuestBourse signal (ACHAT FORT, ACHAT, CONSERVER, ALLÉGER, VENDRE) summarises a composite score and the ▲/▼/● factors shown on the profile. It is a teaching aid, not a market order and not personal advice.\n\nAlways read the label together with the confidence and the reasons shown: a BUY at low confidence does not carry the same weight as a BUY at high confidence. Then cross-check liquidity, the financial statements and your horizon.\n\nNo OuestBourse label replaces a licensed counterparty (SGI, adviser) or the BRVM’s official publications.",
    example:
      "On the SGBC or SNTS profile, the “Final signal” block shows the coloured label, the score /100, the confidence and the ▲/▼/● factors.",
    synonyms: ["Final signal", "Rating"],
    tip: "It is not a market order and not personal advice — always cross-check the financial statements and your own risk profile.",
  },
  "score-composite": {
    title: "Composite score",
    definition:
      "A 0–100 score combining the technical score, the fundamental score, a risk adjustment and a sector score. The higher the score, the more the signal leans toward a buy (subject to risk and confidence constraints).",
    details:
      "The composite score (0–100) combines the technical score, the fundamental score, a risk adjustment and a sector component. The higher it is, the more the signal leans toward a buy — subject to risk and confidence.\n\nA strong score with too much risk or too short a history cannot produce an ACHAT FORT. Conversely, a middling score with stable factors can justify CONSERVER.\n\nThe score moves as data is ingested: a missing year or a P/E shown as N/D often changes confidence as much as the number itself. Use it as a reading grid, not as a final mark.",
    example:
      "A name at 69/100 with high confidence can show ACHAT; a high score with too much risk cannot be ACHAT FORT.",
    synonyms: ["OuestBourse score", "Score /100"],
    tip: "The score moves as data is ingested; a missing year of history changes confidence more than the signal label.",
  },
  "confiance-du-signal": {
    title: "Signal confidence",
    definition:
      "A reading (High, Medium, Low) tied to the depth of the price history. Low confidence caps extreme signals (no overly aggressive ACHAT FORT / VENDRE).",
    details:
      "Confidence (High, Medium, Low) mainly measures how deep a price history is available for the name. It does not predict a rise: it says whether the analysis has enough past to be robust.\n\nLow confidence caps extreme signals: no ACHAT FORT and no overly aggressive VENDRE when the series are too short or too patchy.\n\nOn the BRVM, many names have a partial history: Medium or Low confidence is often honest, not a display fault. Prefer caution and a cross-check with other sources.",
    example: "A company added recently, with mostly the current year on file, will often show Low or Medium confidence.",
    synonyms: ["Signal reliability"],
    tip: "Confidence does not say whether the price will rise: it says whether the analysis has enough history to be robust.",
  },
  volatilite: {
    title: "Volatility",
    definition: "The size and frequency of price moves in a security or an index.",
    details: [
      "Volatility describes the size and frequency of price moves. High volatility means wider moves — and therefore more uncertainty about the next price.",
      "It is not a judgement of quality: a name can be volatile and fundamentally sound, or quiet and fragile. It is a measure of dispersion, not of “quality”.",
      "OuestBourse uses the historical volatility of closes (when the series is dense enough) to enrich the risk score, never as a promise of return.",
    ].join("\n\n"),
    example: "The OuestBourse risk score uses the historical volatility of closes when the series is dense enough.",
    synonyms: ["Variability", "Fluctuation", "Historical volatility"],
    tip: "High volatility means greater uncertainty, not automatically a higher return.",
  },
  liquidite: {
    title: "Liquidity",
    definition: "How easily a security can be bought or sold without moving its price sharply.",
    details: [
      "Liquidity measures how easily you can buy or sell a security without moving its price much. It depends on volumes, order-book depth and the bid/ask spread.",
      "Some BRVM names trade little: exiting a position can then take time or cost you in price slippage.",
      "On OuestBourse, missing or irregular volumes often read as N/D: that is a reason for caution, not a lack of interest in the name.",
    ].join("\n\n"),
    example:
      "Some thinly traded BRVM names still show N/D on volumes — liquidity remains a risk criterion.",
    synonyms: ["Tradability", "Market depth", "Liquidity risk"],
    tip: "Liquidity can vary sharply from session to session and from name to name.",
  },
  rsi: {
    title: "RSI",
    definition:
      "A momentum oscillator (0–100) that compares the average size of up-moves and down-moves over a given window. Created by J. Welles Wilder Jr. and published in 1978 in New Concepts in Technical Trading Systems, it is used mainly to spot overbought / oversold zones and shifts in momentum — not to predict a target price.",
    details: [
      "Usual formula (as documented by Investopedia and StockCharts): RSI = 100 − [100 / (1 + RS)], with RS = average gain ÷ average loss over N periods. Wilder recommends N = 14; losses are counted as positive values. After the first simple average, Wilder applies a specific smoothing (Wilder’s average), which became the platform standard.",
      "Classic reading (Wilder’s thresholds, carried by Fidelity / StockCharts): above ~70, an overbought zone; below ~30, an oversold zone. Between 30 and 70, a zone often treated as neutral; the 50 line marks the relative balance of upward and downward force. Some traders use 80/20 in very volatile markets to filter noise.",
      "An important limit: in a strong trend the RSI can stay above 70 or below 30 for a long time (StockCharts, Investopedia). Crossing a threshold is therefore not an automatic buy or sell signal. Further readings: price/RSI divergences (for example a higher price high with a lower RSI high = bearish divergence), Wilder’s “failure swings”, and a cross of the 50 midline.",
      "Horizon (Investopedia): a shorter period (for example 5–9) makes the indicator more sensitive (more noise, short-term use); a longer period (for example 21–30) smooths more and suits a medium- / long-term reading. On OuestBourse, the workbench and the short-term technical score use RSI(14), Wilder’s historical parameter.",
      "On the BRVM, the limited liquidity of some names can produce irregular price gaps: the RSI stays useful as a complement (price + volume + fundamentals), never as a standalone rule.",
    ].join("\n\n"),
    example:
      "On /graphes, turn on “RSI 14” under the price: you see the 0–100 curve with the ~30 / ~70 guides. The same RSI(14) window also feeds the short-term technical reading of the OuestBourse score (oversold / overbought / neutral zone).",
    synonyms: ["Relative Strength Index", "Wilder RSI"],
    tip: "The 30/70 thresholds are Wilder’s historical guides (1978), not universal rules. In a sustained uptrend, an RSI above 70 can simply confirm strong momentum; always cross-check trend, volume and the fundamental context. See the sources below for the formula and the documented limits.",
  },
  macd: {
    title: "MACD",
    definition: "A momentum indicator based on the gap between two exponential moving averages.",
    details: [
      "The MACD (Moving Average Convergence Divergence), popularised by Gerald Appel, measures the gap between two EMAs (classically 12 and 26) and compares it with a signal line (a 9-period EMA of that gap). The histogram shows the distance between the MACD and the signal.",
      "A common reading: MACD crossing above the signal = upward momentum; a cross below = downward momentum. A positive MACD (above zero) means the short EMA is above the long EMA.",
      "Limit: like any moving average, the MACD lags and can produce false crosses in a sideways market. Price/MACD divergences are alerts to be careful, not certainties.",
    ].join("\n\n"),
    example: "Available as an overlay on /graphes; the MACD histogram also enters the technical reading of the signal.",
    synonyms: ["Moving Average Convergence Divergence"],
    tip: "Signals can lag and produce false crosses.",
  },
  "menu-accueil": {
    title: "Menu: Home (landing)",
    definition:
      "The public entry page introducing OuestBourse, the modules and a quick path to Market, Screener, Charts and the rest of the app.",
    details:
      "Home (/) is the public landing page: an introduction to OuestBourse and a quick path to Market, Screener, Charts and the rest of the application via the header.\n\nThe figures in the stats band are calculated from the real database (number of companies, years covered, and so on), never invented. The light/dark theme is kept as you navigate.\n\nUse this page as a teaching front door, then go deeper on names and signals in the product menus — without confusing a product overview with investment advice.",
    example: "From /, use the header navigation to reach /marche or /education without losing the light/dark theme.",
    synonyms: ["Landing", "Home page"],
    tip: "The figures in the stats band are calculated from real database data, not invented.",
  },
  "menu-marche": {
    title: "Menu: Market",
    definition:
      "Overview of BRVM positions (and the multi-market selector): the list of names, scores, performance/dividends, and access to a profile or a chart.",
    details:
      "The Market menu (/marche) is an overview of BRVM positions: the list of names, scores, performance and dividends, with a multi-market selector (only the BRVM is live today).\n\nClick a position, then choose “Company profile” or “Chart” depending on what you need. Other African venues can appear as “soon” without live data.\n\nMarket guides the daily reading; it places no order. To go deeper on a name, open the profile and check the canonical source, N/D and signal confidence.",
    example: "On /marche, click a position and then choose “Company profile” or “Chart” depending on what you need.",
    synonyms: ["Market board", "Positions"],
    tip: "Other African markets may be marked “soon”: only the BRVM is live today.",
  },
  "menu-screener": {
    title: "Menu: Screener",
    definition:
      "Filter and compare companies by profitability, dividends, growth, valuation, sector or country — wired to calcMetrics.",
    details:
      "The Screener menu opens /screener: filters and comparisons by profitability, dividends, growth, valuation, sector or country, wired to the calculated metrics (calcMetrics).\n\nFilter for example on “Dividends”, then open a profile to read the signal and the confidence. A filter does not replace liquidity or the N/D marks on the profile.\n\nUse the screener to narrow the BRVM universe, not to automate a decision. Always cross-check charts, fundamentals and official sources.",
    example: "On /screener, filter on “Dividends” and then open a profile to read the signal and the confidence.",
    synonyms: ["Security filter", "Screening"],
    tip: "A filter does not replace reading liquidity and the N/D marks on the profile.",
  },
  "menu-graphes": {
    title: "Menu: Charts",
    definition:
      "Chart workbench: candlesticks, ranges, indicators (SMA, RSI, MACD, ADX…), drawings and price alerts (signed-in account).",
    details:
      "The Charts menu opens the /graphes workbench: candlesticks, ranges, indicators (SMA, RSI, MACD, ADX…), overlays and threshold alerts (signed-in account).\n\nTurn indicators on from the dedicated menu; the chips remove an overlay in one click. Advanced indicators are available but often poorly suited to thinly traded BRVM names — see Education › Analysis.\n\nCharts help you read momentum and levels; they execute no trade. Read the source note (densified series, possible synthetic OHLC) before interpreting.",
    example: "On /graphes, open Indicators to turn on RSI or ADX; the chips remove an overlay in one click.",
    synonyms: ["Charting", "Workbench"],
    tip: "Advanced indicators are available but documented as poorly suited to some BRVM names — see Education › Analysis.",
  },
  "menu-fiche-societe": {
    title: "Menu: Company profile",
    definition:
      "The /actions/[ticker] page: price, performance, key data, dividends, financial health, signal, projection and comparison.",
    details:
      "The company profile (/actions/[ticker]) brings together price, performance, key data, dividends, financial health, signal, projection and comparison for one name.\n\nReach it from the Listed companies mega-menu, from Market or from the screener. Any missing figure is shown as N/D — do not invent a missing number.\n\nIt is the core teaching view of a BRVM name: cross-check signal / confidence, fundamentals and charts. It is neither personal advice nor a market order.",
    example:
      "From the Listed companies mega-menu or from Market, open SNTS to see the P/E, the yield and the explanation of the signal.",
    synonyms: ["Security profile", "Company sheet"],
    tip: "Any missing figure is shown as N/D — do not invent a missing number.",
  },
  "menu-portefeuille": {
    title: "Menu: Portfolio",
    definition:
      "Tracking of personal positions (market value, gain/loss versus average purchase price, sector allocation, YTD) — requires a sign-in.",
    details:
      "The Portfolio menu (/portefeuille) tracks your personal positions: market value, gain/loss versus average purchase price (average cost), sector allocation and YTD — sign-in required.\n\nWithout an account, a demo may appear labelled “Illustrative figures”. The gain compares current value with average cost, with the date of the reference price.\n\nThe portfolio is a tracking tool, not an order book: to buy or sell, go through your SGI. The metrics stay based on the canonical prices in the database.",
    example:
      "On /portefeuille, open the average-cost article under Education › Portfolio & tracking to understand the +/- value column.",
    synonyms: ["Personal positions"],
    tip: "Average cost, unrealised gain, YTD and guidance: Education theme “Portfolio & tracking”.",
  },
  "menu-alertes": {
    title: "Menu: Price alerts",
    definition:
      "Thresholds above / below a price, created from /graphes (signed-in account) and evaluated after BRVM quotes are refreshed.",
    details:
      "Price alerts are thresholds above or below a price, created from /graphes (signed-in account) and evaluated after BRVM quotes are refreshed.\n\nExample: an alert “above X FCFA” — status ACTIVE, then TRIGGERED when the threshold is crossed. Alerts are not market orders and execute no trade.\n\nUse them to watch a teaching level or a personal discipline level, then always confirm on the canonical source and with your SGI before acting.",
    example: "Set an alert “above X FCFA” on a ticker: status ACTIVE, then TRIGGERED when the threshold is crossed.",
    synonyms: ["Price alert", "Price threshold"],
    tip: "Alerts are not market orders and execute no trade.",
  },
  "menu-calendrier-dividendes": {
    title: "Menu: Dividend calendar",
    definition:
      "A view of dividend dates and amounts known in the database — useful for planning a yield follow-up, not a promise of a future distribution.",
    details:
      "The dividend calendar (/calendrier-dividendes) lists dates and amounts known in the database — useful for planning a yield follow-up, not a promise of a future distribution.\n\nCross-check the company profile for the calculated yield. If they differ, official BRVM / general-meeting dates prevail.\n\nA past dividend does not imply the next one. Use the calendar as a teaching diary, then check notices and publications on brvm.org before any yield-related decision.",
    example: "Open /calendrier-dividendes and then cross-check the company profile for the calculated yield.",
    synonyms: ["Dividend diary"],
    tip: "Official BRVM / meeting dates prevail if there is a discrepancy.",
  },
};

export function localizeLevelLabel(level: EducationLevel, locale: Locale): string {
  if (locale !== "en") return EDUCATION_LEVEL_LABELS[level];
  return EN_LEVELS[level];
}

export function localizeCategory(category: EducationCategory, locale: Locale): EducationCategory {
  if (locale !== "en") return category;
  const copy = EN_CATEGORIES[category.slug];
  return copy ? { ...category, ...copy } : category;
}

export function localizeCategories(locale: Locale): EducationCategory[] {
  if (locale !== "en") return EDUCATION_CATEGORIES;
  return EDUCATION_CATEGORIES.map((category) => localizeCategory(category, locale));
}

export function localizeTheme(theme: EducationTheme, locale: Locale): EducationTheme {
  if (locale !== "en") return theme;
  const copy = EN_THEMES[theme.slug];
  return copy ? { ...theme, ...copy } : theme;
}

export function localizeThemes(locale: Locale): EducationTheme[] {
  if (locale !== "en") return EDUCATION_THEMES;
  return EDUCATION_THEMES.map((theme) => localizeTheme(theme, locale));
}

export function isEducationTermTranslated(slug: string, locale: Locale): boolean {
  if (locale !== "en") return true;
  return Object.prototype.hasOwnProperty.call(EN_TERMS, slug);
}

/** French catalog term unchanged, or the same term with English fields when present. */
export function localizeTerm<T extends EducationTerm>(term: T, locale: Locale): T {
  if (locale !== "en") return term;
  const copy = EN_TERMS[term.slug];
  if (!copy) return term;
  return {
    ...term,
    title: copy.title,
    definition: copy.definition,
    details: copy.details ?? term.details,
    example: copy.example,
    tip: copy.tip,
    synonyms: copy.synonyms ?? term.synonyms,
  };
}

export function translatedEducationSlugs(): string[] {
  return Object.keys(EN_TERMS).sort();
}

export function untranslatedEducationSlugs(): string[] {
  return getAllEducationTerms()
    .map((term) => term.slug)
    .filter((slug) => !isEducationTermTranslated(slug, "en"))
    .sort();
}

/** French search unchanged. In English, also match the overlay fields. */
export function rankEducationForLocale(query: string, locale: Locale): EducationSearchHit[] {
  const hits = rankEducationSearch(query);
  if (locale !== "en") return hits;
  const folded = foldEducationQuery(query);
  if (!folded) return hits;
  const tokens = folded.split(" ").filter((token) => token.length >= 2);
  const map = new Map(hits.map((hit) => [hit.slug, hit]));

  for (const term of getAllEducationTerms()) {
    const copy = EN_TERMS[term.slug];
    if (!copy) continue;
    const title = foldEducationQuery(copy.title);
    const synonyms = foldEducationQuery((copy.synonyms ?? []).join(" "));
    const definition = foldEducationQuery(copy.definition);
    const details = foldEducationQuery(`${copy.details ?? ""} ${copy.example} ${copy.tip ?? ""}`);
    const all = `${title} ${synonyms} ${definition} ${details}`;
    const tokenHit = tokens.length > 0 && tokens.every((token) => all.includes(token));
    const phraseHit = all.includes(folded);
    if (!tokenHit && !phraseHit) continue;

    let score = 30;
    let matchField: EducationSearchHit["matchField"] = "details";
    if (title === folded) {
      score = 100;
      matchField = "title";
    } else if (tokens.length > 0 && tokens.every((token) => title.includes(token))) {
      score = 84;
      matchField = "title";
    } else if (synonyms && tokens.length > 0 && tokens.every((token) => synonyms.includes(token))) {
      score = 68;
      matchField = "synonym";
    } else if (tokens.length > 0 && tokens.every((token) => definition.includes(token))) {
      score = 40;
      matchField = "definition";
    }

    const prev = map.get(term.slug);
    if (!prev || score > prev.score) {
      map.set(term.slug, { ...term, score, matchField });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title, "fr");
  });
}
