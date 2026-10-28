// Construction pure du modèle de la fiche NGX (8 sections). Aucune lecture base ici :
// le chargeur (lib/markets/ngx-sheet.ts) fournit les lignes, ce module calcule.

import { concludeAllPolicies, type PolicyConclusion, type PolicyFacts } from "./policy";
import {
  buildFinancialYears,
  parseNgxProfileMeta,
  type NgxFinancialYear,
  type NgxProfileFundamentals,
  type RatioRowLike,
} from "./fundamentals";
import { priceStats, type PricePoint, type PriceStats } from "./price-stats";
import { computeNgxScore, type NgxScore } from "./score";
import { cleanNgxName, ngxSectorGroup, type NgxSectorGroup } from "./sectors";
import {
  EQUITY_MIN_SHARE_OF_CAP,
  dividendYearsPaid,
  dividendYieldPercent,
  estimateFairValues,
  growthPercent,
  marginPercent,
  marketCapBn,
  payoutPercent,
  priceToBookFromCap,
  priceToEarningsFromCap,
  relativeGapPercent,
  returnOnEquityPercent,
  sectorStat,
  selectEquityBasis,
  seriesCagrPercent,
  summarizeValuation,
  type FairValueEstimate,
  accountsAreStale,
  type MultipleResult,
  type MultipleStatus,
  type SectorStat,
  type ValuationSummary,
} from "./valuation";

export interface DividendRowLike {
  year: number;
  amount: number;
  exDate: string | null;
  paymentDate: string | null;
  isCanonical: boolean;
  source: string;
}

export interface EventRowLike {
  title: string;
  eventType: string | null;
  eventDate: string;
  endDate: string | null;
  comment: string | null;
  url: string | null;
  sourceName: string;
}

export interface DocumentRowLike {
  title: string | null;
  filename: string | null;
  url: string;
  docType: string | null;
  periodLabel: string | null;
  publishedAt: string | null;
  sourceName: string;
}

export interface CompanyInput {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  board: string | null;
  isin: string | null;
  description: string | null;
  listedSince: string | null;
  profileMeta: unknown;
  /** Dernier cours officiel (₦). */
  close: number | null;
  ratios: RatioRowLike[];
  dividends: DividendRowLike[];
}

export interface SheetInput {
  company: CompanyInput;
  previousClose: number | null;
  changePercent: number | null;
  volume: number | null;
  sessionDate: string | null;
  indicativeFcfa: number | null;
  series: PricePoint[];
  events: EventRowLike[];
  documents: DocumentRowLike[];
  /** Tous les titres NGX (y compris celui-ci) : médianes sectorielles et classement par capitalisation. */
  universe: CompanyInput[];
  /** Métriques de l'univers déjà calculées (écran de tri : évite de les recalculer pour chaque société). */
  universeMetrics?: Array<{ c: CompanyInput; m: CompanyMetrics }>;
  /** YYYY-MM-DD */
  today: string;
}

export interface CompanyMetrics {
  /** Dernier exercice avec un résultat net ou un BPA publié. */
  fiscalYear: number | null;
  /** Dernier exercice dont les comptes sont publiés, quand il a plus de 2 ans : PER / PBR / ROE sont alors « n/s » et exclus. */
  staleAccountsYear: number | null;
  /** BPA publié (jamais recalculé avec le nombre de titres actuel) et son exercice. */
  eps: number | null;
  epsYear: number | null;
  /** Actif net par action = capitaux propres confirmés ÷ titres de l'exercice (résultat net ÷ BPA). Null si indéterminé. */
  bvps: number | null;
  bvpsYear: number | null;
  /** PER = capitalisation ÷ résultat net de l'exercice `perYear`. */
  per: number | null;
  perStatus: MultipleStatus;
  perYear: number | null;
  /** PBR = capitalisation ÷ capitaux propres confirmés de l'exercice `equityYear`. */
  pbr: number | null;
  pbrStatus: MultipleStatus;
  /** Exercice et montant des capitaux propres utilisés (le plus récent confirmé). */
  equityYear: number | null;
  equityBn: number | null;
  /** Capitaux propres plus récents mais non confirmés : signalés, jamais utilisés dans un ratio. */
  equityUnconfirmed: { year: number; equityBn: number } | null;
  yieldPercent: number | null;
  netMarginPercent: number | null;
  roePercent: number | null;
  roeYear: number | null;
  revenueCagrPercent: number | null;
  marketCapBn: number | null;
  /** Résultat net et capitaux propres ramenés au nombre de titres actuel : alimentent seulement la valeur indicative,
   *  de façon cohérente avec le PER et le PBR par capitalisation. */
  impliedEps: number | null;
  impliedBvps: number | null;
}

export type SectorMetricKey = "per" | "pbr" | "yield" | "netMargin" | "roe" | "revenueCagr";

export interface SectorRow {
  key: SectorMetricKey;
  company: number | null;
  /** « n/s », capitaux propres négatifs… quand `company` est null pour une raison autre que l'absence de donnée. */
  companyStatus: MultipleStatus | null;
  stat: SectorStat;
  /** Écart relatif entre la société et la médiane, en %. */
  gapPercent: number | null;
}

export interface DividendLine {
  year: number;
  dps: number;
  payoutPercent: number | null;
  exDate: string | null;
  paymentDate: string | null;
}

/** Exercice avec comptes publiés mais sans ligne DPS : affiché « N/D », jamais comme 0. */
export interface MissingDividendYear {
  year: number;
}

export interface NgxSheetModel {
  ticker: string;
  name: string;
  tier: "FULL" | "COMING_SOON";
  sector: { group: NgxSectorGroup; slug: string; name: string };
  board: string | null;
  header: {
    close: number | null;
    previousClose: number | null;
    changePercent: number | null;
    volume: number | null;
    sessionDate: string | null;
    indicativeFcfa: number | null;
  };
  presentation: {
    description: string | null;
    isin: string | null;
    listedSince: string | null;
    shares: NgxProfileFundamentals["sharesOutstanding"];
    marketCapBn: number | null;
    marketCapRank: number | null;
    rankedCount: number;
    profile: NgxProfileFundamentals["profile"];
  };
  performance: {
    years: NgxFinancialYear[];
    revenueCagr: ReturnType<typeof seriesCagrPercent>;
    netIncomeCagr: ReturnType<typeof seriesCagrPercent>;
    /** Dernier exercice publié (comptes chargés). */
    latestYear: number | null;
    /** Croissance du CA du dernier exercice où le CA de N et de N-1 sont connus (peut être antérieur à latestYear). */
    latestRevenueGrowthPercent: number | null;
    latestRevenueGrowthYear: number | null;
    latestOperatingMarginPercent: number | null;
    latestOperatingMarginYear: number | null;
    /** Dernier exercice où résultat net et CA sont connus. */
    latestNetMarginPercent: number | null;
    latestNetMarginYear: number | null;
    documents: DocumentRowLike[];
  };
  outlook: {
    guidance: EventRowLike[];
    upcoming: EventRowLike[];
    past: EventRowLike[];
    sectorPeers: number;
    sectorRevenueCagr: SectorStat;
  };
  price: {
    stats: PriceStats;
    metrics: CompanyMetrics;
    shares: number | null;
  };
  valuation: { estimates: FairValueEstimate[]; summary: ValuationSummary };
  sectorComparison: {
    rows: SectorRow[];
    peers: number;
    lowConfidence: boolean;
  };
  dividends: {
    lines: DividendLine[];
    yearsPaid: { paid: number; window: number; known: number } | null;
    growthPercent: number | null;
    currentYieldPercent: number | null;
    /** null = non confirmé pour l'exercice courant (à afficher N/D) ; 0 seulement si un DPS à 0 est enregistré. */
    currentDps: number | null;
    /** Exercice du DPS courant (ou du dernier DPS connu quand il n'est plus confirmé). */
    currentDpsYear: number | null;
    /** Dernier exercice avec comptes publiés. */
    lastFiscalYear: number | null;
    /** NONE = aucune ligne ; CONFIRMED = DPS de l'exercice (ou du précédent) enregistré ; UNCONFIRMED = trop ancien. */
    currentStatus: "NONE" | "CONFIRMED" | "UNCONFIRMED";
    /** Exercices récents avec comptes mais sans ligne DPS (du plus récent au plus ancien). */
    missingYears: MissingDividendYear[];
  };
  policies: PolicyConclusion[];
  /** Note 0–100 (global + 4 politiques), dérivée des sections ci-dessus. */
  score: NgxScore;
}

// ───────────── Aides ─────────────

function bestPerYear<T extends { year: number; isCanonical: boolean; source: string }>(rows: readonly T[]): T[] {
  const rank = (r: T) => (r.isCanonical ? 0 : 10) + (r.source === "NGX_OFFICIEL" ? 0 : r.source === "MANUEL" ? 1 : 5);
  const best = new Map<number, T>();
  for (const r of rows) {
    const cur = best.get(r.year);
    if (!cur || rank(r) < rank(cur)) best.set(r.year, r);
  }
  return [...best.values()].sort((a, b) => a.year - b.year);
}

function latestWith<T>(
  years: readonly NgxFinancialYear[],
  pick: (y: NgxFinancialYear) => T | null,
): { year: number; value: T } | null {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const v = pick(years[i]);
    if (v != null) return { year: years[i].year, value: v };
  }
  return null;
}

/** Dernière croissance du CA calculable (N et N-1 consécutifs, CA connus), avec son exercice. */
function latestRevenueGrowth(years: readonly NgxFinancialYear[]): { year: number; percent: number } | null {
  for (let i = years.length - 1; i >= 1; i -= 1) {
    if (years[i].year - years[i - 1].year !== 1) continue;
    const g = growthPercent(years[i - 1].revenueBn, years[i].revenueBn);
    if (g != null) return { year: years[i].year, percent: g };
  }
  return null;
}

/** Dernière marge calculable (numérateur et CA connus pour le même exercice), avec son exercice. */
function latestMargin(
  years: readonly NgxFinancialYear[],
  numerator: (y: NgxFinancialYear) => number | null,
): { year: number; percent: number } | null {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const m = marginPercent(numerator(years[i]), years[i].revenueBn);
    if (m != null) return { year: years[i].year, percent: m };
  }
  return null;
}

export interface CurrentDividend {
  /** null = non confirmé (aucune ligne pour l'exercice courant ou le précédent). 0 = « pas de dividende » enregistré. */
  dps: number | null;
  /** Exercice de la dernière ligne DPS connue. */
  year: number | null;
  status: "NONE" | "CONFIRMED" | "UNCONFIRMED";
}

/**
 * Dividende retenu pour le rendement : dernière ligne DPS si elle porte sur l'un des deux derniers exercices
 * publiés. Plus ancienne, elle n'est plus confirmée pour l'exercice courant : on renvoie null (N/D) et jamais 0,
 * car l'absence de ligne ne signifie pas « pas de dividende ». Seul un DPS enregistré à 0 vaut 0.
 */
export function currentDividend(
  lines: ReadonlyArray<{ year: number; dps: number }>,
  lastFiscalYear: number | null,
): CurrentDividend {
  if (lines.length === 0) return { dps: null, year: null, status: "NONE" };
  const latest = lines[lines.length - 1];
  if (lastFiscalYear != null && latest.year < lastFiscalYear - 1)
    return { dps: null, year: latest.year, status: "UNCONFIRMED" };
  return { dps: latest.dps, year: latest.year, status: "CONFIRMED" };
}

export function computeCompanyMetrics(company: CompanyInput, today?: string): CompanyMetrics {
  const meta = parseNgxProfileMeta(company.profileMeta);
  const years = buildFinancialYears(company.ratios, meta);
  // Nombre de titres ACTUEL (annuaire NGX) : uniquement pour la capitalisation.
  const shares = meta.sharesOutstanding?.value ?? null;
  const price = company.close;
  const cap = marketCapBn(price, shares);
  const epsLatest = latestWith(years, (y) => y.epsNgn);
  const netLatest = latestWith(years, (y) => y.netIncomeBn);
  const eps = epsLatest?.value ?? null;

  // Capitaux propres : dernier exercice confirmé ; le plus récent non confirmé est seulement signalé.
  const { basis, unconfirmedLatest } = selectEquityBasis(years);
  const equityBn = basis?.equityBn ?? null;
  const equityOk = equityBn != null && equityBn > 0 && (cap == null || equityBn >= cap * EQUITY_MIN_SHARE_OF_CAP);

  // Comptes trop anciens (ex. dernier exercice FY2022 en 2026) : le cours actuel n'a plus de rapport avec eux.
  const lastAccountsYear = years.length > 0 ? years[years.length - 1].year : null;
  const stale = accountsAreStale(lastAccountsYear, today);
  const STALE: MultipleResult = { value: null, status: "stale" };
  const per = stale ? STALE : priceToEarningsFromCap(cap, netLatest?.value ?? null);
  const pbr = stale ? STALE : priceToBookFromCap(cap, equityBn);

  const bvps =
    basis && equityBn != null && equityBn > 0 && basis.eraShares != null ? (equityBn * 1e9) / basis.eraShares : null;
  const roe = !stale && equityOk && basis ? returnOnEquityPercent(basis.netIncomeBn, equityBn) : null;

  const withMargin = [...years].reverse().find((y) => y.netIncomeBn != null && y.revenueBn != null);
  const fiscalYear = Math.max(epsLatest?.year ?? -Infinity, netLatest?.year ?? -Infinity);
  const fiscalYearOrNull = Number.isFinite(fiscalYear) ? fiscalYear : null;
  const lines = bestPerYear(company.dividends).map((d) => ({
    year: d.year,
    dps: d.amount,
  }));
  const dps = currentDividend(lines, fiscalYearOrNull).dps;
  return {
    fiscalYear: fiscalYearOrNull,
    staleAccountsYear: stale ? lastAccountsYear : null,
    eps,
    epsYear: epsLatest?.year ?? null,
    bvps,
    bvpsYear: bvps != null && basis ? basis.year : null,
    per: per.value,
    perStatus: per.status,
    perYear: netLatest?.year ?? null,
    pbr: pbr.value,
    pbrStatus: pbr.status,
    equityYear: basis?.year ?? null,
    equityBn,
    equityUnconfirmed:
      unconfirmedLatest && unconfirmedLatest.equityBn != null
        ? { year: unconfirmedLatest.year, equityBn: unconfirmedLatest.equityBn }
        : null,
    yieldPercent: dividendYieldPercent(dps, price),
    netMarginPercent: withMargin ? marginPercent(withMargin.netIncomeBn, withMargin.revenueBn) : null,
    roePercent: roe,
    roeYear: roe != null && basis ? basis.year : null,
    revenueCagrPercent: seriesCagrPercent(years, (y) => y.revenueBn).cagr,
    marketCapBn: cap,
    impliedEps: per.status === "ok" && shares && netLatest ? (netLatest.value * 1e9) / shares : null,
    impliedBvps: pbr.status === "ok" && shares && equityBn != null ? (equityBn * 1e9) / shares : null,
  };
}

const ROW_PICK: Record<SectorMetricKey, (m: CompanyMetrics) => number | null> = {
  per: (m) => m.per,
  pbr: (m) => m.pbr,
  yield: (m) => m.yieldPercent,
  netMargin: (m) => m.netMarginPercent,
  roe: (m) => m.roePercent,
  revenueCagr: (m) => m.revenueCagrPercent,
};
const SECTOR_KEYS: SectorMetricKey[] = ["per", "pbr", "yield", "netMargin", "roe", "revenueCagr"];

export function buildNgxSheet(input: SheetInput): NgxSheetModel {
  const { company } = input;
  const group = ngxSectorGroup(company.ticker, company.sectorSlug || company.sectorName);
  const meta = parseNgxProfileMeta(company.profileMeta);
  const years = buildFinancialYears(company.ratios, meta);
  const shares = meta.sharesOutstanding?.value ?? null;
  const close = company.close;
  const stats = priceStats(input.series);

  // Classement par capitalisation (sociétés avec cours et titres connus).
  const universeMetrics =
    input.universeMetrics ??
    input.universe.map((c) => ({
      c,
      m: computeCompanyMetrics(c, input.today),
    }));
  const ranked = universeMetrics
    .filter((x) => x.m.marketCapBn != null)
    .sort((a, b) => (b.m.marketCapBn ?? 0) - (a.m.marketCapBn ?? 0));
  const rankIdx = ranked.findIndex((x) => x.c.ticker === company.ticker);

  const metrics = computeCompanyMetrics(company, input.today);
  const peers = universeMetrics.filter(
    (x) => x.c.ticker !== company.ticker && ngxSectorGroup(x.c.ticker, x.c.sectorSlug || x.c.sectorName) === group,
  );
  const sectorRows: SectorRow[] = SECTOR_KEYS.map((key) => {
    const stat = sectorStat(peers.map((p) => ROW_PICK[key](p.m)));
    const mine = ROW_PICK[key](metrics);
    return {
      key,
      company: mine,
      companyStatus:
        key === "per"
          ? metrics.perStatus
          : key === "pbr"
            ? metrics.pbrStatus
            : key === "roe" && metrics.staleAccountsYear != null
              ? "stale"
              : null,
      stat,
      gapPercent: relativeGapPercent(mine, stat.median),
    };
  });
  const perStat = sectorRows.find((r) => r.key === "per")!.stat;
  const pbrStat = sectorRows.find((r) => r.key === "pbr")!.stat;
  const peerWithData = Math.max(...sectorRows.map((r) => r.stat.n), 0);

  const estimates = estimateFairValues({
    price: close,
    eps: metrics.impliedEps,
    bvps: metrics.impliedBvps,
    sectorPer: perStat,
    sectorPbr: pbrStat,
  });
  const summary = summarizeValuation(close, estimates);

  // Performance
  const revenueCagr = seriesCagrPercent(years, (y) => y.revenueBn);
  const netIncomeCagr = seriesCagrPercent(years, (y) => y.netIncomeBn);
  const lastYear = years[years.length - 1];
  const revenueGrowth = latestRevenueGrowth(years);
  const operatingMargin = latestMargin(years, (y) => y.operatingIncomeBn);
  const netMargin = latestMargin(years, (y) => y.netIncomeBn);

  // Dividendes
  const divRows = bestPerYear(company.dividends);
  const lines: DividendLine[] = divRows
    .map((d) => {
      const epsOfYear = years.find((y) => y.year === d.year)?.epsNgn ?? null;
      return {
        year: d.year,
        dps: d.amount,
        payoutPercent: payoutPercent(d.amount, epsOfYear),
        exDate: d.exDate,
        paymentDate: d.paymentDate,
      };
    })
    .sort((a, b) => b.year - a.year);
  const asc = [...lines].sort((a, b) => a.year - b.year);
  const lastFiscal = metrics.fiscalYear;
  const current = currentDividend(asc, lastFiscal);
  const currentDps = current.dps;
  const confirmed = current.status === "CONFIRMED";
  const window = asc.slice(-5);
  // Évolution et taux de distribution ne se lisent que si le dividende courant est confirmé.
  const dividendGrowth =
    confirmed && window.length >= 3 && window[0].dps > 0
      ? growthPercent(window[0].dps, window[window.length - 1].dps)
      : null;
  const missingYears: MissingDividendYear[] = [];
  if (current.year != null && lastFiscal != null)
    for (let y = lastFiscal; y > current.year && missingYears.length < 5; y -= 1) missingYears.push({ year: y });
  const yearsPaid =
    asc.length > 0 && lastFiscal != null
      ? dividendYearsPaid(
          asc.map((l) => ({ year: l.year, amount: l.dps })),
          lastFiscal,
          5,
        )
      : null;
  const lastDividendLine = lines[0];
  const payoutLatest = confirmed ? (lastDividendLine?.payoutPercent ?? null) : null;

  // Résultats positifs sur les 5 derniers exercices connus
  const recent = years.filter((y) => y.netIncomeBn != null).slice(-5);

  const facts: PolicyFacts = {
    revenueCagrPercent: revenueCagr.cagr,
    growthSpanYears: revenueCagr.span,
    netIncomeCagrPercent: netIncomeCagr.cagr,
    latestNetIncomeBn: latestWith(years, (y) => y.netIncomeBn)?.value ?? null,
    roePercent: metrics.roePercent,
    profitableYears: recent.filter((y) => (y.netIncomeBn ?? 0) > 0).length,
    knownYears: recent.length,
    valuationVerdict: summary.verdict,
    dividendYieldPercent: dividendYieldPercent(currentDps, close),
    dividendYearsPaid: yearsPaid?.paid ?? null,
    dividendWindow: yearsPaid?.window ?? 5,
    dividendYearsKnown: yearsPaid?.known ?? null,
    payoutPercent: payoutLatest,
    dividendGrowthPercent: dividendGrowth,
    price: stats,
  };

  const fullTier = years.length > 0;
  let policies = concludeAllPolicies(facts);
  if (!fullTier) policies = policies.filter((p) => p.type === "TRADING");

  const events = [...input.events].sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));
  const guidance = events.filter((e) => (e.eventType ?? "").toUpperCase() === "GUIDANCE");
  const others = events.filter((e) => (e.eventType ?? "").toUpperCase() !== "GUIDANCE");
  const upcoming = others
    .filter((e) => e.eventDate >= input.today)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))
    .slice(0, 8);
  const past = others.filter((e) => e.eventDate < input.today).slice(0, 8);

  const docs = [...input.documents]
    .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1))
    .slice(0, 12);

  const model: Omit<NgxSheetModel, "score"> = {
    ticker: company.ticker,
    name: cleanNgxName(company.name),
    tier: fullTier ? "FULL" : "COMING_SOON",
    sector: { group, slug: company.sectorSlug, name: company.sectorName },
    board: company.board,
    header: {
      close,
      previousClose: input.previousClose,
      changePercent: input.changePercent,
      volume: input.volume,
      sessionDate: input.sessionDate,
      indicativeFcfa: input.indicativeFcfa,
    },
    presentation: {
      description: company.description,
      isin: company.isin,
      listedSince: company.listedSince,
      shares: meta.sharesOutstanding,
      marketCapBn: metrics.marketCapBn,
      marketCapRank: rankIdx >= 0 ? rankIdx + 1 : null,
      rankedCount: ranked.length,
      profile: meta.profile,
    },
    performance: {
      years,
      revenueCagr,
      netIncomeCagr,
      latestYear: lastYear?.year ?? null,
      latestRevenueGrowthPercent: revenueGrowth?.percent ?? null,
      latestRevenueGrowthYear: revenueGrowth?.year ?? null,
      latestOperatingMarginPercent: operatingMargin?.percent ?? null,
      latestOperatingMarginYear: operatingMargin?.year ?? null,
      latestNetMarginPercent: netMargin?.percent ?? null,
      latestNetMarginYear: netMargin?.year ?? null,
      documents: docs,
    },
    outlook: {
      guidance,
      upcoming,
      past,
      sectorPeers: peers.length,
      sectorRevenueCagr: sectorRows.find((r) => r.key === "revenueCagr")!.stat,
    },
    price: { stats, metrics, shares },
    valuation: { estimates, summary },
    sectorComparison: {
      rows: sectorRows,
      peers: peerWithData,
      lowConfidence: peerWithData < 4,
    },
    dividends: {
      lines,
      yearsPaid,
      growthPercent: dividendGrowth,
      currentYieldPercent: dividendYieldPercent(currentDps, close),
      currentDps,
      currentDpsYear: current.year,
      lastFiscalYear: lastFiscal,
      currentStatus: current.status,
      missingYears,
    },
    policies,
  };
  return { ...model, score: computeNgxScore(model) };
}
