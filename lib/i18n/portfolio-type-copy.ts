// Display-only overlay for portfolio-type catalog sentences.
// French strings stay in lib/portfolio-types/catalog.ts and are returned unchanged
// when locale is fr. Do not edit that catalog (tests).
//
// Translated for en: label, shortLabel, tagline, objective, horizon, risk, method,
// checklist, warnings, filterHints, CTA labels, plus allocation / simulation
// sentences shown on /simulation. Framing headlines, summaries, metric labels
// and pocket hints are translated here because PortfolioTypePerspective renders them.

import type { AnalysisPerspective, PerspectiveMetric } from "@/lib/portfolio-types/framing";
import type { PortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import type { PortfolioTypeId } from "@/lib/portfolio-types/constants";
import type { Locale } from "./config";
import type { LabelsApi } from "./labels";

type Overlay = {
  label: string;
  shortLabel: string;
  tagline: string;
  objective: string;
  horizon: string;
  risk: string;
  method: string;
  checklist: string[];
  warnings: string[];
  filterHints: string[];
  ctaLabels: string[];
  allocation: Array<{ component: string; allocation: string }>;
  allocationNote: string;
  simulationLead: string;
  simulationHints: string[];
  suggestNote: string;
};

const EN: Record<PortfolioTypeId, Overlay> = {
  CROISSANCE: {
    label: "Growth",
    shortLabel: "Growth",
    tagline: "Grow capital over the long term through fundamentals.",
    objective: "Increase the value of capital",
    horizon: "Long term (generally at least five years)",
    risk: "Medium to high",
    method: "Fundamental analysis",
    checklist: [
      "Is revenue growing steadily?",
      "Are earnings (net income) increasing?",
      "Is the company becoming more profitable (margins)?",
      "Is debt under control?",
      "Does the business actually generate cash?",
      "Does the sector still have potential?",
      "Is financial information regular and reliable?",
      "Does the price already reflect all of the expected growth?",
    ],
    warnings: [
      "A fast rise in the price is not, by itself, a growth thesis.",
      "The dividend is secondary: a growth company may pay little if it reinvests effectively.",
      "The BRVM Growth compartment is not enough to pick a stock — financial analysis is required.",
      "Do not sell only because the price fell: have the fundamentals changed?",
    ],
    filterHints: [
      "Prefer a long enough history of accounts and prices to judge progress.",
      "Compare valuation (P/E) with the sector rather than keeping the stock that is rising.",
      "Cap a line at about 10–15% of the portfolio (educational model).",
    ],
    ctaLabels: ["Growth guide", "Screener (growth / valuation)"],
    allocation: [
      { component: "Core growth stocks", allocation: "60%" },
      { component: "Secondary growth stocks", allocation: "20%" },
      { component: "Quality defensive stocks", allocation: "10%" },
      { component: "Cash", allocation: "10%" },
    ],
    allocationNote:
      "Educational model. Indicative staged buying: 30% / 30% / 40%. No allocation guarantees a return.",
    simulationLead:
      "Long-term capital projection: the horizon and contributions matter more than a “maximum” return.",
    simulationHints: [
      "Educational horizon: at least 5 years — consistent with a growth thesis.",
      "Invest in tranches rather than putting all the capital in on the same day.",
      "Keep a cash sleeve (~10% in the model) to smooth timing.",
    ],
    suggestNote: "Long assumption (10 years) and moderate fees — adapt it to your SGI, not a promised return.",
  },
  RENTE: {
    label: "Income",
    shortLabel: "Income",
    tagline: "Regular income: dividend quality, not the highest yield.",
    objective: "Generate regular income",
    horizon: "Medium / long term",
    risk: "Low to medium",
    method: "Dividends, bonds, stability",
    checklist: [
      "Has the dividend been regular over several years?",
      "Is the payout ratio sustainable?",
      "Are earnings growing, or does the high yield come from a depressed price?",
      "Does the company generate cash to pay the coupon / dividend?",
      "Does debt remain compatible with a lasting distribution?",
      "Is the sector relatively stable?",
      "Does the income depend on a single company, a single sector or a single country?",
    ],
    warnings: [
      "A high dividend can be exceptional, non-recurring, or the mirror of a sharply depressed price.",
      "A portfolio that pays 8% income but loses 15% of capital is not necessarily performing well.",
      "Distinguish current yield (income / current value) from total return (income + change in capital).",
      "BRVM bonds can complement dividend stocks: study the issuer, maturity, coupon and repayment risk.",
    ],
    filterHints: [
      "Do not sort only by the highest dividend yield.",
      "Check how regular distributions are, and how deep the history is.",
      "Diversify income sources (companies, sectors, UEMOA countries, bond maturities).",
    ],
    ctaLabels: ["Income guide", "Screener (dividends)"],
    allocation: [
      { component: "Durable dividend stocks", allocation: "45%" },
      { component: "Bonds", allocation: "35%" },
      { component: "Defensive stocks", allocation: "10%" },
      { component: "Cash", allocation: "10%" },
    ],
    allocationNote:
      "In retirement the bond share can be larger; while accumulating, the equity share can be increased. Educational model.",
    simulationLead:
      "The simulation projects capital: for an income portfolio, also reread current yield versus total return (gain or loss included).",
    simulationHints: [
      "While building capital, dividends can be reinvested (underweight lines, temporarily cheaper quality, bonds, cash).",
      "A high income yield does not necessarily offset a fall in capital.",
      "Educational horizon: medium / long term, with few frequent trades.",
    ],
    suggestNote: "Long horizon and a tighter scenario spread — an illustration of stability, not a promised coupon.",
  },
  TRADING: {
    label: "Trading",
    shortLabel: "Trading",
    tagline: "Price moves, liquidity, position size and written rules.",
    objective: "Take advantage of price moves",
    horizon: "Short / medium term",
    risk: "High",
    method: "Entry, exit and risk-management rules",
    checklist: [
      "Is the security traded enough (liquidity, BRVM-30 / official price bulletin)?",
      "Is the horizon written down (short term, swing, position) — and kept after a loss?",
      "Are entry price, reason, invalidation, target, maximum duration and size defined before the order?",
      "Does risk per trade stay at or below 0.5% to 1% of capital?",
      "Does the potential gain exceed SGI fees + BRVM/DCBR commissions + taxes + the spread + execution risk?",
      "Is performance measured after fees (win rate, average gain/loss, drawdown)?",
    ],
    warnings: [
      "High-risk activity: liquidity in some BRVM stocks is limited — a counterparty at the desired price is not guaranteed.",
      "Include fees in every trade: the contract note (price, brokerage, commissions, taxes, net).",
      "The trading portfolio should generally not represent all invested wealth.",
      "A stock bought for trading must not automatically become a long-term holding because its price falls.",
    ],
    filterHints: [
      "Prefer securities that are traded enough; consult the official bulletins and the BRVM-30.",
      "Size the position from risk (capital × maximum risk / invalidation distance), not from how many shares you like.",
      "Start small; increase size only after steady performance net of fees.",
    ],
    ctaLabels: ["Trading guide", "Position size calculator", "Charts (trend, volume)"],
    allocation: [
      { component: "Trading positions", allocation: "60% of the trading portfolio" },
      { component: "Available cash", allocation: "30%" },
      { component: "Opportunity or protection reserve", allocation: "10%" },
    ],
    allocationNote: "This frames the trading portfolio, not total wealth. Educational model.",
    simulationLead:
      "A buy-and-hold projection understates turnover costs: this framing stresses costs, liquidity and risk per trade.",
    simulationHints: [
      "Do not read the curve as a trading plan: it is an educational projection of capital.",
      "Fees: the more frequent the turnover, the more net return erodes — raise the fee % to illustrate it.",
      "Prudent rule: 0.5% to 1% of capital at risk per trade (see the calculator).",
    ],
    suggestNote:
      "Shorter horizon, higher fees and a wider spread to illustrate the cost of trading — not a real scenario of your trades.",
  },
  CROISSANCE_MAX: {
    label: "Max Growth",
    shortLabel: "Max growth",
    tagline: "Three distinct sleeves: growth, income, trading — plus cash.",
    objective: "Optimize the portfolio’s overall growth",
    horizon: "All horizons",
    risk: "Medium to high",
    method: "An organized combination of the three sleeves",
    checklist: [
      "Which sleeve should this security sit in (growth, income, trading) — and why?",
      "Are the sleeve rules written down and distinct?",
      "Would a price drop wrongly slide a trading position into the long term?",
      "Is the 100-point score (revenue/earnings, margins, strength, dividend, valuation, liquidity) filled in without inventing a figure?",
      "Is a periodic rebalance (6–12 months) planned if a sleeve drifts?",
    ],
    warnings: [
      "The main mistake is mixing every position without distinct rules.",
      "This is not “take maximum risk”: it separates roles for organized growth.",
      "The scoring system (80–100 priority, and so on) does not replace analysis.",
      "Measure net return after fees, including uninvested cash, and compare it with an index (BRVM Composite / BRVM-30).",
    ],
    filterHints: [
      "Growth sleeve: quarterly or half-yearly decisions.",
      "Income sleeve: follow dividends, coupons and risks.",
      "Trading sleeve: a written plan, limited size, and results after fees before raising the allocation.",
      "Cash sleeve: an uninvested reserve, for protection and opportunities.",
    ],
    ctaLabels: ["Max Growth guide", "Shared rules", "Simulation (sleeve view)"],
    allocation: [
      { component: "Long-term growth (value creation)", allocation: "50%" },
      { component: "Dividends and income (income and stability)", allocation: "25%" },
      { component: "Trading (tactical opportunities)", allocation: "15%" },
      { component: "Cash (protection and opportunities)", allocation: "10%" },
    ],
    allocationNote:
      "Balanced model. Educational variants: offensive 55/20/20/5; cautious 40/35/10/15. Adapt to horizon, capital and available time.",
    simulationLead:
      "The single curve does not show the sleeves: read the allocation and rebalance rather than treating everything as one strategy.",
    simulationHints: [
      "Build gradually: growth first, then income, a reserve, a small trading sleeve, and increase trading only if results are steady.",
      "If trading moves from 15% to 25% after a rise, the educational example is to bring it back toward 15%.",
      "Net return = (final value + income − capital invested − fees) / capital invested.",
    ],
    suggestNote:
      "Mixed horizon and fees a little higher than a pure buy-and-hold (trading sleeve) — an illustration, not a backtest.",
  },
};

const EXTRA_CTA_EN: Record<string, string> = {
  "Guide Croissance": "Growth guide",
  "Screener (croissance / valorisation)": "Screener (growth / valuation)",
  "Guide Rente": "Income guide",
  "Screener (dividendes)": "Screener (dividends)",
  "Guide Trading": "Trading guide",
  "Calculette taille de position": "Position size calculator",
  "Graphes (tendance, volumes)": "Charts (trend, volume)",
  "Guide Croissance Max": "Max Growth guide",
  "Règles communes": "Shared rules",
  "Simulation (perspective poches)": "Simulation (sleeve view)",
  "Taille de position": "Position size",
};

const METRIC_EN: Record<string, { label: string; hint: string }> = {
  perf5: {
    label: "5-year performance",
    hint: "Price path — not proof that earnings are growing.",
  },
  perf10: {
    label: "Long-term performance",
    hint: "Long history when it exists; otherwise N/D.",
  },
  yield: {
    label: "Dividend yield",
    hint: "Current level, not the quality or recurrence of the dividend.",
  },
  risk: {
    label: "Risk (volatility)",
    hint: "Risk-management score {score}/100 · {tier}.",
  },
  confidence: {
    label: "Signal confidence",
    hint: "Depth of the data — an extreme signal is less reliable when confidence is low.",
  },
  fundamental: {
    label: "Fundamental score",
    hint: "Dividends, P/E and regularity measured on file — not an audit of the accounts.",
  },
  technical: {
    label: "Technical score",
    hint: "Useful for trading when the series is dense enough; otherwise N/D on RSI/MACD.",
  },
  liquidity: {
    label: "Liquidity risk",
    hint: "Pillar of the risk score: a high score means tighter liquidity. Also check the BRVM-30 / the official list.",
  },
  longHorizon: {
    label: "Long-term score",
    hint: "Multi-horizon reading already calculated — growth framing.",
  },
  shortHorizon: {
    label: "Short-term score",
    hint: "Short-term reading — it does not replace an entry / invalidation plan.",
  },
};

export function localizedTypeDef(def: PortfolioTypeDef, locale: Locale): PortfolioTypeDef {
  if (locale !== "en") return def;
  const en = EN[def.id];
  return {
    ...def,
    label: en.label,
    shortLabel: en.shortLabel,
    tagline: en.tagline,
    objective: en.objective,
    horizon: en.horizon,
    risk: en.risk,
    method: en.method,
    checklist: en.checklist,
    warnings: en.warnings,
    filterHints: en.filterHints,
    ctas: def.ctas.map((cta, index) => ({
      ...cta,
      label: en.ctaLabels[index] ?? localizeCtaLabel(cta.label, locale),
    })),
    allocation: def.allocation.map((row, index) => en.allocation[index] ?? row),
    allocationNote: en.allocationNote,
    simulationLead: en.simulationLead,
    simulationHints: en.simulationHints,
    simulationSuggest: { ...def.simulationSuggest, note: en.suggestNote },
  };
}

export function localizeCtaLabel(label: string, locale: Locale): string {
  if (locale !== "en") return label;
  return EXTRA_CTA_EN[label] ?? label;
}

type LabelFns = Pick<LabelsApi, "signal" | "confidence" | "riskLevel" | "riskTier">;

const SIGNALS = new Set(["ACHAT FORT", "ACHAT", "CONSERVER", "ALLÉGER", "VENDRE"]);

function signalWord(raw: string, labels: LabelFns): string {
  return SIGNALS.has(raw) ? labels.signal(raw as "ACHAT") : raw;
}

function translateSummary(summary: string, labels: LabelFns): string {
  const growth = summary.match(
    /^(.+) \(([A-Z0-9.]+)\) — signal plateforme (.+) \(inchangé\)\. Sous l’angle Croissance, on lit d’abord la progression des fondamentaux et la valorisation, pas la seule hausse du cours\. Score fondamental (\d+)\/100 · long terme (\d+)\/100 · confiance (.+)\.$/
  );
  if (growth) {
    return `${growth[1]} (${growth[2]}) — platform signal ${signalWord(growth[3]!, labels)} (unchanged). From a Growth angle, read fundamentals and valuation first, not the price rise alone. Fundamental score ${growth[4]}/100 · long term ${growth[5]}/100 · confidence ${labels.confidence(growth[6]!)}.`;
  }
  const income = summary.match(
    /^(.+) \(([A-Z0-9.]+)\) — signal plateforme (.+) \(inchangé\)\. Sous l’angle Rente, le rendement du dividende se lit avec sa régularité et le risque de capital, pas comme un « taux garanti »\. Rendement affiché (.+) · risque (.+)\.$/
  );
  if (income) {
    return `${income[1]} (${income[2]}) — platform signal ${signalWord(income[3]!, labels)} (unchanged). From an Income angle, dividend yield is read with its regularity and capital risk, not as a “guaranteed rate”. Displayed yield ${income[4]} · risk ${labels.riskLevel(income[5]!)}.`;
  }
  const trading = summary.match(
    /^(.+) \(([A-Z0-9.]+)\) — signal plateforme (.+) \(inchangé\)\. Sous l’angle Trading, priorité à la liquidité, à la taille de position et aux règles écrites\. Risque (.+) · technique (\d+)\/100 · liquidité (.+)\.$/
  );
  if (trading) {
    return `${trading[1]} (${trading[2]}) — platform signal ${signalWord(trading[3]!, labels)} (unchanged). From a Trading angle, liquidity, position size and written rules come first. Risk ${labels.riskLevel(trading[4]!)} · technical ${trading[5]}/100 · liquidity ${trading[6]}.`;
  }
  const max = summary.match(
    /^(.+) \(([A-Z0-9.]+)\) — signal plateforme (.+) \(inchangé\)\. Sous l’angle Croissance Max, le titre n’entre dans une poche que si vous lui assignez un rôle \(croissance, rente ou trading\) avec des règles distinctes\. ([\s\S]+)$/
  );
  if (max) {
    return `${max[1]} (${max[2]}) — platform signal ${signalWord(max[3]!, labels)} (unchanged). From a Max Growth angle, the security enters a sleeve only if you assign it a role (growth, income or trading) with distinct rules. ${translatePocket(max[4]!)}`;
  }
  return summary;
}

function translatePocket(text: string): string {
  const pairs: Array<[string, string]> = [
    [
      "lecture croissance / fondamentaux (score fondamental disponible)",
      "growth / fundamentals reading (fundamental score available)",
    ],
    [
      "lecture rente (rendement du dividende affiché — à vérifier en qualité, pas seulement en niveau)",
      "income reading (displayed dividend yield — check quality, not just the level)",
    ],
    [
      "lecture trading possible seulement si la liquidité le permet (pilier liquidité ci-contre)",
      "a trading reading is possible only if liquidity allows it (liquidity pillar alongside)",
    ],
    [
      "liquidité défavorable pour une poche trading (pilier élevé = plus de risque de liquidité)",
      "liquidity is unfavorable for a trading sleeve (a high pillar score means more liquidity risk)",
    ],
    [
      "Aucune poche n’est « assignée » automatiquement : classez le titre vous-même (croissance, rente ou trading) d’après les données disponibles, ou N/D.",
      "No sleeve is assigned automatically: classify the security yourself (growth, income or trading) from the available data, or N/D.",
    ],
    [
      "Pistes de poche (présentation, pas une affectation) : ",
      "Sleeve ideas (presentation, not an assignment): ",
    ],
  ];
  let next = text;
  for (const [from, to] of pairs) next = next.replace(from, to);
  return next.replaceAll(" ; ", "; ");
}

function translateMetric(metric: PerspectiveMetric, labels: LabelFns): PerspectiveMetric {
  const copy = METRIC_EN[metric.key];
  if (!copy) return metric;
  let value = metric.value;
  if (metric.key === "risk") value = labels.riskLevel(metric.value);
  if (metric.key === "confidence") value = labels.confidence(metric.value);
  let hint = copy.hint;
  if (metric.key === "risk") {
    const match = metric.hint.match(/^Score gestion du risque (\d+)\/100 · (.+)\.$/);
    if (match) hint = `Risk-management score ${match[1]}/100 · ${labels.riskTier(match[2]!)}.`;
  }
  return { ...metric, label: copy.label, value, hint };
}

const DISCLAIMER_EN =
  "Educational framing for the portfolio type. Prices, ratios and signals are not recalculated. Missing data is shown as N/D. This is not investment advice.";

export function localizedPerspective(
  perspective: AnalysisPerspective,
  locale: Locale,
  labels: LabelFns
): AnalysisPerspective {
  const def = localizedTypeDef(perspective.def, locale);
  if (locale !== "en") return { ...perspective, def };
  const headlineMatch = perspective.headline.match(/^(.*) — lecture de (.*)$/);
  return {
    ...perspective,
    def,
    headline: headlineMatch ? `${def.label} — reading of ${headlineMatch[2]}` : perspective.headline,
    summary: translateSummary(perspective.summary, labels),
    metrics: perspective.metrics.map((metric) => translateMetric(metric, labels)),
    checklist: def.checklist,
    warnings: def.warnings,
    filterHints: def.filterHints,
    ctas: perspective.ctas.map((cta) => ({ ...cta, label: localizeCtaLabel(cta.label, locale) })),
    pocketHint: perspective.pocketHint ? translatePocket(perspective.pocketHint) : null,
    disclaimer: DISCLAIMER_EN,
  };
}
