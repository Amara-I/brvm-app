"use client";

// Workbench graphique OuestBourse — /graphes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  rangeFilter,
  type ChartClosePoint,
  type ChartRange,
} from "@/lib/charts/indicators";
import {
  apiRangeForChartRange,
  chartWindowFingerprint,
  companyChartApiPath,
  lastPointAsOf,
  seriesCoversChartRange,
  seriesCoversIntervalLookback,
} from "@/lib/charts/chart-window";
import { CANDLE_INTERVALS, type CandleInterval } from "@/lib/charts/ohlc-aggregate";
import { buildSyncedChartView } from "@/lib/charts/synced-chart-view";
import { computeWindowChangeFromCandles } from "@/lib/charts/window-change";
import TradingChart, {
  type ChartIndicatorsState,
  type ChartViewUndoEntry,
  type DrawToolId,
} from "./TradingChart";
import ChartAnalysisControls, {
  type SavedAnalysisSummary,
} from "./ChartAnalysisControls";
import ChartAlertControls from "./ChartAlertControls";
import AnalysisRecap from "@/components/analysis/AnalysisRecap";
import { trackFeature } from "@/components/analytics/track-client";
import PortfolioTickerAction from "@/components/portfolio/PortfolioTickerAction";
import { C } from "@/lib/theme/colors";
import { truncateSummary } from "@/lib/calc/analysis-recap";
import type { TechnicalSnapshot } from "@/lib/charts/technical-indicators";
import type { ChartDrawing } from "@/lib/charts/chart-drawings-storage";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  chartSignalSummary,
  chartTechnicalLines,
  displaySignalLabel,
  formatSavedAt,
  localizeApiMessage,
  localizeIntervalNote,
  loosePercent,
  ohlcLegend as formatOhlcLegend,
  signedGrouped,
  windowChangeAbs,
  windowChangePercent,
  yieldLabel,
} from "./chart-locale";
import styles from "./ChartWorkbench.module.css";

const VALID_RANGES = new Set<ChartRange>([
  "1J",
  "5J",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1A",
  "5A",
  "MAX",
]);

const VALID_INTERVALS = new Set<CandleInterval>(["1H", "1D", "1W", "1M"]);

function normalizeIndicators(raw: unknown): ChartIndicatorsState {
  const base: ChartIndicatorsState = {
    sma10: false,
    sma20: true,
    sma50: false,
    sma200: false,
    ema12: false,
    ema26: false,
    bollinger: false,
    rsi: false,
    macd: false,
    obv: false,
    volumeFlow: false,
    adx: false,
    stochastic: false,
    williamsR: false,
    cci: false,
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  (Object.keys(base) as Array<keyof ChartIndicatorsState>).forEach((k) => {
    if (typeof o[k] === "boolean") base[k] = o[k] as boolean;
  });
  return base;
}

type UndoEntry =
  | ChartViewUndoEntry
  | { type: "indicators"; indicators: ChartIndicatorsState };

export interface ChartUniverseItem {
  ticker: string;
  name: string;
  color: string;
  sector: string;
  countryFlag: string;
}

interface ChartApiPayload {
  ticker: string;
  name: string;
  color: string;
  country: string;
  countryFlag: string;
  sector: string;
  series: ChartClosePoint[];
  lookback?: ChartClosePoint[];
  fundamentals: {
    per: number | null;
    mktCapMds: number | null;
    dividendYieldPercent: number | null;
  };
  stats: {
    lastClose: number | null;
    lastDate: string | null;
    firstDate: string | null;
    points: number;
    dayChangePercent: number | null;
    dayChangeAbs: number | null;
    change1YPercent: number | null;
    lastVolume: number | null;
    source: string | null;
    seriesSources?: string[];
    seriesEnriched?: boolean;
    historyPoints?: number;
    historyFirstDate?: string | null;
    historyLastDate?: string | null;
    range?: string;
    from?: string | null;
    to?: string | null;
    lookbackExhausted?: boolean;
    reconciliation?: {
      thresholdPercent: number;
      discrepanciesCount: number;
      densifySources: string[];
      priority: string[];
    };
  };
  analysis?: {
    signalLabel: string;
    signalColor: string;
    score: number;
    technicalScore: number;
    fundamentalScore: number;
    confidence: string;
    signalSummary: string;
    technical: TechnicalSnapshot;
    horizonScores: { court: number; moyen: number; long: number };
    riskTier: string;
    riskScore: number;
  };
  /** Série déjà peinte (fiche) — remplacée quand l'API renvoie une fenêtre différente. */
  provisional?: boolean;
}

function buildProvisionalPayload(
  ticker: string,
  series: ChartClosePoint[],
  item: ChartUniverseItem | undefined,
  historyComplete: boolean
): ChartApiPayload {
  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;
  const dayChangePercent =
    last && prev && prev.value > 0
      ? Math.round(((last.value - prev.value) / prev.value) * 10000) / 100
      : null;
  const dayChangeAbs = last && prev ? Math.round((last.value - prev.value) * 100) / 100 : null;
  return {
    ticker,
    name: item?.name ?? ticker,
    color: item?.color ?? "#1f8f4e",
    country: "",
    countryFlag: item?.countryFlag ?? "",
    sector: item?.sector ?? "",
    series,
    lookback: [],
    provisional: true,
    fundamentals: { per: null, mktCapMds: null, dividendYieldPercent: null },
    stats: {
      lastClose: last?.value ?? null,
      lastDate: last?.time ?? null,
      firstDate: series[0]?.time ?? null,
      points: series.length,
      dayChangePercent,
      dayChangeAbs,
      change1YPercent: null,
      lastVolume: last?.volume ?? null,
      source: null,
      historyPoints: historyComplete ? series.length : undefined,
      historyFirstDate: series[0]?.time ?? null,
      historyLastDate: last?.time ?? null,
      range: historyComplete ? "MAX" : undefined,
      lookbackExhausted: historyComplete ? true : undefined,
    },
  };
}

const RANGE_KEYS: ChartRange[] = ["1J", "5J", "1M", "3M", "6M", "YTD", "1A", "5A", "MAX"];

const COMPARE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6"];

const DRAW_TOOLS: Array<{ id: DrawToolId; icon: string }> = [
  { id: "cross", icon: "+" },
  { id: "zoom", icon: "⌕" },
  { id: "trend", icon: "/" },
  { id: "measure", icon: "⇅" },
  { id: "horiz", icon: "—" },
  { id: "fib", icon: "φ" },
  { id: "undo", icon: "↶" },
  { id: "trash", icon: "⌫" },
];

const INDICATOR_OPTS: Array<keyof ChartIndicatorsState> = [
  "sma10",
  "sma20",
  "sma50",
  "sma200",
  "ema12",
  "ema26",
  "bollinger",
  "rsi",
  "macd",
  "adx",
  "stochastic",
  "williamsR",
  "cci",
  "obv",
  "volumeFlow",
];

export default function ChartWorkbench({
  universe,
  initialTicker,
  embedded = false,
  isAuthenticated = false,
  initialSeries,
  initialSeriesComplete = false,
}: {
  universe: ChartUniverseItem[];
  initialTicker: string;
  /** Sur fiche société : masque le lien « Ouvrir la fiche » (déjà sur place). */
  embedded?: boolean;
  /** Compte actif — active la sauvegarde cloud des analyses. */
  isAuthenticated?: boolean;
  /** Série déjà chargée (fiche) — premier paint sans attendre /api/charts. */
  initialSeries?: ChartClosePoint[];
  /** Vrai quand `initialSeries` est le MAX `chart_series` à jour (couvre toutes les plages). */
  initialSeriesComplete?: boolean;
}) {
  const { t, format, labels, locale } = useI18n();
  const router = useRouter();
  const [ticker, setTicker] = useState(initialTicker);

  useEffect(() => {
    setTicker(initialTicker);
  }, [initialTicker]);
  const [query, setQuery] = useState("");
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [range, setRange] = useState<ChartRange>("1A");
  const [interval, setInterval] = useState<CandleInterval>("1D");
  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicatorsState>({
    sma10: false,
    sma20: true,
    sma50: false,
    sma200: false,
    ema12: false,
    ema26: false,
    bollinger: false,
    rsi: false,
    macd: false,
    obv: false,
    volumeFlow: false,
    adx: false,
    stochastic: false,
    williamsR: false,
    cci: false,
  });
  const [showIndicators, setShowIndicators] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [percentScale, setPercentScale] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [payload, setPayload] = useState<ChartApiPayload | null>(() => {
    if (!initialSeries || initialSeries.length === 0) return null;
    const item = universe.find((u) => u.ticker === initialTicker);
    return buildProvisionalPayload(initialTicker, initialSeries, item, initialSeriesComplete);
  });
  const [compareData, setCompareData] = useState<Record<string, ChartClosePoint[]>>({});
  const [loading, setLoading] = useState(!(initialSeries && initialSeries.length > 0));
  const [error, setError] = useState<string | null>(null);
  const [ohlcLegend, setOhlcLegend] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawToolId>("cross");
  const [clearDrawToken, setClearDrawToken] = useState(0);
  const [undoApplyToken, setUndoApplyToken] = useState(0);
  const [undoApplyEntry, setUndoApplyEntry] = useState<ChartViewUndoEntry | null>(null);
  const [resetZoomToken, setResetZoomToken] = useState(0);
  const [intervalNote, setIntervalNote] = useState<string | null>(null);
  const [chartHeight, setChartHeight] = useState(520);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [seedDrawings, setSeedDrawings] = useState<ChartDrawing[] | null>(null);
  const [drawingsSeedKey, setDrawingsSeedKey] = useState(0);
  const [activeSavedAnalysis, setActiveSavedAnalysis] = useState<SavedAnalysisSummary | null>(null);
  const [savedAnalysesCount, setSavedAnalysesCount] = useState(0);
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false);
  const autoLoadedTickerRef = useRef<string | null>(null);
  const undoStackRef = useRef<UndoEntry[]>([]);
  const chartUndoApiRef = useRef<{ hasPendingTrend: () => boolean } | null>(null);

  useEffect(() => {
    function syncHeight() {
      const w = window.innerWidth;
      if (fullscreen) {
        setChartHeight(Math.max(360, Math.min(window.innerHeight - 200, 780)));
        return;
      }
      if (w <= 480) setChartHeight(320);
      else if (w <= 720) setChartHeight(380);
      else if (w <= 980) setChartHeight(460);
      else setChartHeight(520);
    }
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);


  const filteredUniverse = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universe;
    return universe.filter(
      (u) => u.ticker.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [universe, query]);

  const indicatorCount = useMemo(
    () => Object.values(indicators).filter(Boolean).length,
    [indicators]
  );

  const payloadRef = useRef<ChartApiPayload | null>(null);
  payloadRef.current = payload;
  const loadSeq = useRef(0);

  const loadTicker = useCallback(async (symbol: string, viewRange: ChartRange, viewInterval: CandleInterval) => {
    const apiRange = apiRangeForChartRange(viewRange);
    const current = payloadRef.current;
    const combined =
      current?.ticker === symbol ? [...(current.lookback ?? []), ...current.series] : [];
    const complete =
      current?.ticker === symbol &&
      (current.stats.range === "MAX" ||
        (typeof current.stats.historyPoints === "number" &&
          current.stats.historyPoints <= combined.length));
    const rangeOk =
      current?.ticker === symbol && seriesCoversChartRange(combined, apiRange, Boolean(complete));
    const lookbackOk =
      current?.ticker === symbol &&
      seriesCoversIntervalLookback({
        points: combined,
        range: apiRange,
        interval: viewInterval,
        historyComplete: Boolean(complete),
        lookbackExhausted: current.stats.lookbackExhausted === true,
      });
    // Série API déjà suffisante : pas de second aller-retour.
    // Une série provisoire (fiche) reste affichée, mais on complète fondamentaux / analyse.
    if (current?.ticker === symbol && !current.provisional && rangeOk && lookbackOk) {
      return;
    }
    const seq = ++loadSeq.current;
    const paintReady = combined.length > 0;
    if (!paintReady) {
      if (current && current.ticker !== symbol) setPayload(null);
      setLoading(true);
    }
    setError(null);
    try {
      // Sans `cache: "no-store"` : le navigateur peut réutiliser la réponse
      // (max-age du prefetch fiche) au lieu de relancer Sika/Rich.
      const res = await fetch(companyChartApiPath(symbol, apiRange, viewInterval));
      const text = await res.text();
      let json: { ok?: boolean; error?: string; data?: unknown } = {};
      try {
        json = text ? (JSON.parse(text) as { ok?: boolean; error?: string; data?: unknown }) : {};
      } catch {
        throw new Error(t("charts.errors.seriesUnavailable"));
      }
      if (loadSeq.current !== seq) return;
      if (!json.ok) throw new Error(localizeApiMessage(json.error ?? "Série indisponible — N/D", t));
      const next = json.data as ChartApiPayload;
      setPayload((prev) => {
        if (!prev || prev.ticker !== next.ticker) return next;
        const prevPoints = [...(prev.lookback ?? []), ...prev.series];
        const nextPoints = [...(next.lookback ?? []), ...next.series];
        if (chartWindowFingerprint(prevPoints, viewRange) === chartWindowFingerprint(nextPoints, viewRange)) {
          return { ...next, series: prev.series, lookback: prev.lookback };
        }
        return next;
      });
    } catch (e) {
      if (loadSeq.current !== seq) return;
      if (!paintReady) {
        setError(e instanceof Error ? e.message : String(e));
        setPayload(null);
      }
    } finally {
      if (loadSeq.current === seq) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTicker(ticker, range, interval);
  }, [ticker, range, interval, loadTicker]);

  useEffect(() => {
    let cancelled = false;
    const apiRange = apiRangeForChartRange(range);
    async function loadCompare() {
      const next: Record<string, ChartClosePoint[]> = {};
      await Promise.all(
        compare.map(async (symbol) => {
          try {
            const res = await fetch(companyChartApiPath(symbol, apiRange, interval));
            const json = await res.json();
            if (json.ok) {
              const data = json.data as ChartApiPayload;
              next[symbol] = [...(data.lookback ?? []), ...data.series];
            }
          } catch {
            /* ignore */
          }
        })
      );
      if (!cancelled) setCompareData(next);
    }
    if (compare.length) void loadCompare();
    else setCompareData({});
    return () => {
      cancelled = true;
    };
  }, [compare, range, interval]);

  const payloadSeries = payload?.series;
  const payloadLookback = payload?.lookback;
  const historySeries = useMemo(
    () => (payloadSeries ? [...(payloadLookback ?? []), ...payloadSeries] : []),
    [payloadSeries, payloadLookback]
  );

  /** Fenêtre visible (cours bruts) — même `rangeFilter` + asOf que le graphique. */
  const windowSeries = useMemo(() => {
    if (historySeries.length === 0) return [];
    return rangeFilter(historySeries, range, lastPointAsOf(historySeries));
  }, [historySeries, range]);

  const mainSeries = windowSeries;

  const windowChange = useMemo(() => {
    const from = windowSeries[0]?.time;
    const to = windowSeries[windowSeries.length - 1]?.time;
    if (!from || !to) return null;
    const { candles } = buildSyncedChartView({
      fullPoints: historySeries,
      visibleFrom: from,
      visibleTo: to,
      interval,
      lookbackBars: 1,
      percentScale: false,
    });
    return computeWindowChangeFromCandles(candles);
  }, [historySeries, windowSeries, interval]);

  const hasRealVolume = useMemo(
    () => (payload?.series ?? []).some((p) => typeof p.volume === "number" && p.volume > 0),
    [payload]
  );

  const compareSeries = useMemo(() => {
    if (!percentScale && compare.length === 0) return [];
    return compare
      .map((symbol, i) => {
        const raw = compareData[symbol];
        if (!raw) return null;
        const pts = rangeFilter(raw, range, lastPointAsOf(raw));
        return { id: symbol, color: COMPARE_COLORS[i % COMPARE_COLORS.length]!, points: pts };
      })
      .filter(Boolean) as Array<{ id: string; color: string; points: ChartClosePoint[] }>;
  }, [compare, compareData, range, percentScale]);

  function selectTicker(symbol: string) {
    const next = symbol.toUpperCase();
    if (next === ticker) {
      setShowWatchlist(false);
      setQuery("");
      return;
    }
    autoLoadedTickerRef.current = null;
    setShowWatchlist(false);
    setQuery("");
    setSeedDrawings(null);
    setActiveSavedAnalysis(null);
    if (embedded) {
      router.push(`/actions/${next}?tab=charts`);
      return;
    }
    router.replace(`/graphes?ticker=${encodeURIComponent(next)}`, { scroll: false });
    setTicker(next);
  }

  const applySavedAnalysis = useCallback(
    (analysis: SavedAnalysisSummary) => {
      const nextTicker = analysis.ticker.toUpperCase();
      if (
        embedded &&
        nextTicker !== ticker &&
        universe.some((u) => u.ticker === nextTicker)
      ) {
        router.push(`/actions/${nextTicker}?tab=charts`);
        return;
      }
      if (universe.some((u) => u.ticker === nextTicker)) {
        if (!embedded && nextTicker !== ticker) {
          router.replace(`/graphes?ticker=${encodeURIComponent(nextTicker)}`, { scroll: false });
        }
        setTicker(nextTicker);
        setShowWatchlist(false);
        setQuery("");
      }
      if (VALID_RANGES.has(analysis.range as ChartRange)) {
        setRange(analysis.range as ChartRange);
      }
      if (VALID_INTERVALS.has(analysis.interval)) {
        setInterval(analysis.interval);
      }
      setIndicators(normalizeIndicators(analysis.indicators));
      const comps = Array.isArray(analysis.compareTickers)
        ? analysis.compareTickers
            .filter((symbol) => universe.some((u) => u.ticker === symbol) && symbol !== nextTicker)
            .slice(0, 5)
        : [];
      setCompare(comps);
      const nextDrawings = Array.isArray(analysis.drawings) ? analysis.drawings : [];
      setDrawings(nextDrawings);
      setSeedDrawings(nextDrawings);
      setDrawingsSeedKey((n) => n + 1);
      setActiveSavedAnalysis(analysis);
    },
    [universe, embedded, ticker, router]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedAnalysesCount(0);
      setActiveSavedAnalysis(null);
      autoLoadedTickerRef.current = null;
      return;
    }
    let cancelled = false;
    async function loadLatestSaved() {
      try {
        const res = await fetch(`/api/charts/analyses?ticker=${encodeURIComponent(ticker)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        const analyses = (json.data?.analyses ?? []) as SavedAnalysisSummary[];
        setSavedAnalysesCount(analyses.length);
        if (autoLoadedTickerRef.current === ticker) return;
        autoLoadedTickerRef.current = ticker;
        if (analyses.length === 0) {
          setActiveSavedAnalysis(null);
          return;
        }
        applySavedAnalysis(analyses[0]!);
      } catch {
        if (!cancelled) setSavedAnalysesCount(0);
      }
    }
    void loadLatestSaved();
    return () => {
      cancelled = true;
    };
  }, [ticker, isAuthenticated, applySavedAnalysis]);

  function recordUndo(entry: UndoEntry) {
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > 80) {
      undoStackRef.current.splice(0, undoStackRef.current.length - 80);
    }
  }

  function performUndo() {
    if (chartUndoApiRef.current?.hasPendingTrend()) {
      setUndoApplyEntry(null);
      setUndoApplyToken((n) => n + 1);
      return;
    }
    const entry = undoStackRef.current.pop();
    if (!entry) {
      setUndoApplyEntry(null);
      setUndoApplyToken((n) => n + 1);
      return;
    }
    if (entry.type === "indicators") {
      setIndicators(entry.indicators);
      return;
    }
    setUndoApplyEntry(entry);
    setUndoApplyToken((n) => n + 1);
  }

  function setIndicatorsWithUndo(
    updater: (prev: ChartIndicatorsState) => ChartIndicatorsState
  ) {
    setIndicators((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      const changed = (Object.keys(prev) as Array<keyof ChartIndicatorsState>).some(
        (k) => prev[k] !== next[k]
      );
      if (changed) recordUndo({ type: "indicators", indicators: { ...prev } });
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndo) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      e.preventDefault();
      performUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changer de ticker → historique d'annulation local à la session du titre
  useEffect(() => {
    undoStackRef.current = [];
  }, [ticker]);

  function toggleCompare(symbol: string) {
    setCompare((prev) => {
      if (prev.includes(symbol)) return prev.filter((x) => x !== symbol);
      if (prev.length >= 3 || symbol === ticker) return prev;
      return [...prev, symbol];
    });
  }

  function onToolClick(id: DrawToolId) {
    if (id === "trash") {
      setClearDrawToken((n) => n + 1);
      setActiveTool("cross");
      return;
    }
    if (id === "undo") {
      performUndo();
      return;
    }
    setActiveTool(id);
  }

  const stats = payload?.stats;
  const fund = payload?.fundamentals;
  const priceUp = (stats?.dayChangePercent ?? 0) >= 0;
  const defaultLegend = useMemo(() => {
    if (!mainSeries.length) return null;
    const last = mainSeries[mainSeries.length - 1]!;
    const prev = mainSeries.length > 1 ? mainSeries[mainSeries.length - 2]! : last;
    const chg = prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : 0;
    return formatOhlcLegend(
      prev.value,
      Math.max(prev.value, last.value),
      Math.min(prev.value, last.value),
      last.value,
      chg,
      last.volume,
      locale,
      format
    );
  }, [mainSeries, locale, format]);

  const intervalLabel = t(`charts.intervals.${interval}.label`);
  const visibleRangeLabel = t(`charts.ranges.${range}`);
  const changeLabel = t("charts.metrics.rangeChange", { range: visibleRangeLabel });
  const changeAbs = windowChangeAbs(windowChange?.abs, locale, format);
  const changePct = windowChangePercent(windowChange?.percent, locale, format);
  const changeTitle = windowChange
    ? `${changeAbs} · ${locale === "fr" ? range : visibleRangeLabel}${
        interval !== "1D" ? ` · ${intervalLabel}` : ""
      }`
    : t("charts.metrics.changeNd");

  function marketStatusLabel(): string {
    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return t("charts.market.closed");
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (mins >= 9 * 60 + 30 && mins <= 14 * 60 + 30) return t("charts.market.open");
    return t("charts.market.closed");
  }

  function chartSourceNote(): string {
    const sources =
      payload?.stats.seriesSources && payload.stats.seriesSources.length > 0
        ? payload.stats.seriesSources.join(" + ")
        : (payload?.stats.source ?? "N/D");
    const points = payload?.stats.points ?? mainSeries.length;
    let text = t("charts.footer.source", { sources });
    text += t("charts.footer.points", { count: points });
    if (
      payload?.stats.historyPoints != null &&
      payload.stats.historyPoints !== (payload.stats.points ?? 0)
    ) {
      const windowRange = payload.stats.range ?? range;
      const windowLabel =
        locale === "en" && VALID_RANGES.has(windowRange as ChartRange)
          ? t(`charts.ranges.${windowRange as ChartRange}`)
          : windowRange;
      text += t("charts.footer.window", {
        range: windowLabel,
        count: payload.stats.historyPoints,
      });
    }
    if (payload?.stats.seriesEnriched) {
      const densify = payload.stats.reconciliation?.densifySources?.join(" + ");
      text += densify
        ? t("charts.footer.densifiedWith", { sources: densify })
        : t("charts.footer.densified");
    }
    if (payload?.stats.reconciliation && payload.stats.reconciliation.discrepanciesCount > 0) {
      text += t("charts.footer.discrepancies", {
        count: payload.stats.reconciliation.discrepanciesCount,
        threshold: payload.stats.reconciliation.thresholdPercent,
      });
    } else if (payload?.stats.seriesEnriched) {
      text += t("charts.footer.crossCheck");
    }
    text += " ";
    text += t("charts.footer.volumeOhlc", {
      volume: hasRealVolume ? t("charts.footer.volumeReal") : "N/D",
    });
    return text;
  }

  return (
    <div
      className={`${styles.workbench} ${fullscreen ? styles.fullscreen : ""} ${
        showWatchlist ? styles.workbenchMenuOpen : ""
      }`}
    >
      <header className={styles.tvHeader}>
        <div className={styles.symbolBlock}>
          <button
            type="button"
            className={styles.logoMark}
            onClick={() => setShowWatchlist((v) => !v)}
            title={t("charts.changeSymbol")}
            aria-expanded={showWatchlist}
          >
            {payload?.ticker?.slice(0, 1) ?? "·"}
          </button>
          <div className={styles.symbolPick}>
            <button type="button" className={styles.symbolBtn} onClick={() => setShowWatchlist((v) => !v)}>
              <span className={styles.ticker}>{payload?.ticker ?? ticker}</span>
              <span className={styles.chev}>▾</span>
            </button>
            <div className={styles.companyName}>{payload?.name ?? ""}</div>
            {showWatchlist && (
              <div className={styles.watchlist}>
                <input
                  className={styles.search}
                  type="search"
                  placeholder={t("charts.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  aria-label={t("charts.searchAria")}
                />
                <div className={styles.watchlistScroll}>
                  {filteredUniverse.map((u) => (
                    <button
                      key={u.ticker}
                      type="button"
                      className={u.ticker === ticker ? styles.itemActive : styles.item}
                      onClick={() => selectTicker(u.ticker)}
                    >
                      <span className={styles.itemTicker}>
                        {u.countryFlag} {u.ticker}
                      </span>
                      <span className={styles.itemName}>{u.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.priceBlock}>
          <div className={styles.lastPrice} style={{ color: priceUp ? "#26a69a" : "#ef5350" }}>
            {stats?.lastClose != null ? `${format.number(stats.lastClose)} FCFA` : "N/D"}
          </div>
          <div className={styles.dayChange} style={{ color: priceUp ? "#26a69a" : "#ef5350" }}>
            {stats?.dayChangeAbs != null && stats.dayChangePercent != null
              ? `${signedGrouped(stats.dayChangeAbs, format)} (${loosePercent(stats.dayChangePercent, locale, format)})`
              : "N/D"}
            <span className={styles.marketStatus}>
              {t("charts.market.today")}
              {marketStatusLabel()}
            </span>
          </div>
        </div>

        <div className={styles.metrics}>
          <Metric
            label={changeLabel}
            value={changePct}
            up={windowChange == null ? undefined : windowChange.percent >= 0}
            title={changeTitle}
          />
          <Metric
            label={t("charts.metrics.volume")}
            value={
              stats?.lastVolume != null && stats.lastVolume > 0 ? format.number(stats.lastVolume) : "N/D"
            }
          />
          <Metric
            label={t("charts.metrics.marketCap")}
            value={
              fund?.mktCapMds != null && fund.mktCapMds > 0
                ? t("charts.metrics.mktCapValue", { value: format.number(fund.mktCapMds) })
                : "N/D"
            }
          />
          <Metric
            label={t("charts.metrics.pe")}
            value={fund?.per != null && fund.per > 0 ? format.decimal(fund.per, 1) : "N/D"}
          />
          <Metric
            label={t("charts.metrics.dividend")}
            value={
              fund?.dividendYieldPercent != null && fund.dividendYieldPercent > 0
                ? yieldLabel(Number(fund.dividendYieldPercent), locale, format)
                : "N/D"
            }
          />
        </div>

        <div className={styles.headerActions}>
          <ChartAnalysisControls
            isAuthenticated={isAuthenticated}
            ticker={ticker}
            drawings={drawings}
            indicators={indicators}
            range={range}
            interval={interval}
            compare={compare}
            onApply={applySavedAnalysis}
            onSaved={() => {
              autoLoadedTickerRef.current = ticker;
              void fetch(`/api/charts/analyses?ticker=${encodeURIComponent(ticker)}`, {
                cache: "no-store",
              })
                .then((r) => r.json())
                .then((json) => {
                  if (json.ok) {
                    setSavedAnalysesCount((json.data?.analyses ?? []).length);
                  }
                })
                .catch(() => undefined);
            }}
            open={analysisPanelOpen}
            onOpenChange={setAnalysisPanelOpen}
            savedCount={savedAnalysesCount}
            loginCallbackPath={
              embedded ? `/actions/${ticker}` : `/graphes?ticker=${encodeURIComponent(ticker)}`
            }
          />
          <ChartAlertControls
            isAuthenticated={isAuthenticated}
            ticker={ticker}
            lastClose={stats?.lastClose ?? null}
            loginCallbackPath={
              embedded ? `/actions/${ticker}` : `/graphes?ticker=${encodeURIComponent(ticker)}`
            }
          />
          <PortfolioTickerAction
            ticker={ticker}
            isAuthenticated={isAuthenticated}
            signal={{
              label: displaySignalLabel(payload?.analysis?.signalLabel ?? "CONSERVER", labels),
              color: payload?.analysis?.signalColor ?? C.gold,
              score: payload?.analysis?.score,
            }}
            addClassName={styles.primaryBtn}
          />
        </div>
      </header>

      {isAuthenticated && activeSavedAnalysis ? (
        <div className={styles.savedAnalysisBanner} role="status">
          <span>
            {t("charts.saved.loadedBefore")}
            <strong>{activeSavedAnalysis.name}</strong>
            {activeSavedAnalysis.updatedAt
              ? t("charts.saved.loadedAfterDated", {
                  date: formatSavedAt(activeSavedAnalysis.updatedAt, format, true),
                })
              : t("charts.saved.loadedAfter")}
          </span>
          <button
            type="button"
            className={styles.savedAnalysisBannerBtn}
            onClick={() => setAnalysisPanelOpen(true)}
          >
            {t("charts.saved.chooseOther")}
          </button>
        </div>
      ) : isAuthenticated && savedAnalysesCount === 0 ? (
        <div className={styles.savedAnalysisHint} role="note">
          <span>
            {t("charts.saved.hintBefore")}
            <strong>{t("charts.saved.hintStrong")}</strong>
            {t("charts.saved.hintAfter")}
          </span>
        </div>
      ) : null}

      <div className={styles.tvToolbar}>
        <div className={styles.toolGroup}>
          <div className={styles.dropdownWrap}>
            <button
              type="button"
              className={showIntervalMenu ? styles.toolPillActive : styles.tfBadgeBtn}
              onClick={() => {
                setShowIntervalMenu((v) => !v);
                setShowIndicators(false);
                setShowCompare(false);
              }}
              title={t("charts.intervalMenu")}
              aria-expanded={showIntervalMenu}
            >
              {intervalLabel} ▾
            </button>
            {showIntervalMenu && (
              <div className={styles.dropdown}>
                {CANDLE_INTERVALS.map((opt) => {
                  const label = t(`charts.intervals.${opt.key}.label`);
                  const title = t(`charts.intervals.${opt.key}.title`);
                  return (
                  <button
                    key={opt.key}
                    type="button"
                    className={interval === opt.key ? styles.dropItemActive : styles.dropItemBtn}
                    title={title}
                    onClick={() => {
                      setInterval(opt.key);
                      setShowIntervalMenu(false);
                      trackFeature("graphes", `interval:${opt.key}`);
                    }}
                  >
                    {label} — {title}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
          <span className={styles.candleIcon} title={t("charts.candlesticks")}>
            ▮
          </span>
        </div>

        <div className={styles.toolGroup}>
          <div className={styles.dropdownWrap}>
            <button
              type="button"
              className={showIndicators ? styles.toolPillActive : styles.toolPill}
              onClick={() => {
                setShowIndicators((v) => !v);
                setShowCompare(false);
                setShowIntervalMenu(false);
              }}
            >
              {t("charts.indicatorsButton")}{" "}
              {indicatorCount > 0 ? <span className={styles.badge}>{indicatorCount}</span> : null}
            </button>
            {showIndicators && (
              <div className={styles.dropdown}>
                {INDICATOR_OPTS.map((key) => (
                  <label key={key} className={styles.dropItem}>
                    <input
                      type="checkbox"
                      checked={indicators[key]}
                      onChange={(e) =>
                        setIndicatorsWithUndo((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                    />
                    {t(`charts.indicators.${key}`)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.dropdownWrap}>
            <button
              type="button"
              className={showCompare ? styles.toolPillActive : styles.toolPill}
              onClick={() => {
                setShowCompare((v) => !v);
                setShowIndicators(false);
                setShowIntervalMenu(false);
              }}
            >
              {t("charts.compare")}
            </button>
            {showCompare && (
              <div className={styles.dropdown}>
                {universe
                  .filter((u) => u.ticker !== ticker)
                  .slice(0, 20)
                  .map((u) => (
                    <label key={u.ticker} className={styles.dropItem}>
                      <input
                        type="checkbox"
                        checked={compare.includes(u.ticker)}
                        onChange={() => toggleCompare(u.ticker)}
                      />
                      {u.ticker}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.toolGroupRight}>
          {RANGE_KEYS.map((key) => {
            const label = t(`charts.ranges.${key}`);
            return (
            <button
              key={key}
              type="button"
              className={range === key ? styles.rangeActive : styles.rangeBtn}
              onClick={() => {
                setRange(key);
                trackFeature("graphes", `range:${key}`);
              }}
              aria-pressed={range === key}
              title={t("charts.ranges.rangeTitle", { label })}
            >
              {label}
            </button>
            );
          })}
          <span
            className={
              windowChange == null
                ? styles.rangeChgNd
                : windowChange.percent >= 0
                  ? styles.rangeChgUp
                  : styles.rangeChgDown
            }
            aria-live="polite"
            title={windowChange ? `${changeLabel} · ${changeAbs}` : t("charts.metrics.changeNd")}
          >
            {changePct}
          </span>
          <button
            type="button"
            className={percentScale ? styles.toolChipOn : styles.toolChip}
            onClick={() => setPercentScale((v) => !v)}
            aria-pressed={percentScale}
            title={t("charts.percentTitle")}
          >
            <span className={styles.toolChipGlyph}>%</span>
            <span className={styles.toolChipLabel}>{t("charts.percent")}</span>
          </button>
          <button
            type="button"
            className={logScale ? styles.toolChipOn : styles.toolChip}
            onClick={() => setLogScale((v) => !v)}
            aria-pressed={logScale}
            title={t("charts.logTitle")}
          >
            <span className={styles.toolChipGlyph}>log</span>
            <span className={styles.toolChipLabel}>{t("charts.log")}</span>
          </button>
          <button
            type="button"
            className={styles.toolChip}
            onClick={() => {
              setPercentScale(false);
              setLogScale(false);
              setResetZoomToken((n) => n + 1);
            }}
            title={t("charts.autoTitle")}
          >
            <span className={styles.toolChipGlyph}>auto</span>
            <span className={styles.toolChipLabel}>{t("charts.auto")}</span>
          </button>
          <button
            type="button"
            className={fullscreen ? styles.toolChipExit : styles.toolChip}
            onClick={() => setFullscreen((v) => !v)}
            aria-pressed={fullscreen}
            title={fullscreen ? t("charts.fullscreenExit") : t("charts.fullscreen")}
          >
            <span className={styles.toolChipGlyph}>{fullscreen ? "✕" : "⛶"}</span>
            <span className={styles.toolChipLabel}>
              {fullscreen ? t("charts.reduce") : t("charts.fullscreen")}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.chartRow}>
        <aside className={styles.drawRail} aria-label={t("charts.toolsAria")}>
          {DRAW_TOOLS.map((tool) => {
            const label = t(`charts.tools.${tool.id}.label`);
            return (
            <button
              key={tool.id}
              type="button"
              className={activeTool === tool.id ? styles.railBtnActive : styles.railBtn}
              title={label}
              aria-label={label}
              aria-pressed={activeTool === tool.id}
              onClick={() => onToolClick(tool.id)}
            >
              <span className={styles.railIcon}>{tool.icon}</span>
              <span className={styles.railLabel}>{t(`charts.tools.${tool.id}.short`)}</span>
            </button>
            );
          })}
        </aside>

        <div className={styles.chartCol}>
          <div className={styles.legendBar}>{ohlcLegend ?? defaultLegend ?? "—"}</div>
          {intervalNote && <div className={styles.intervalNote}>{localizeIntervalNote(intervalNote, t)}</div>}
          <div className={styles.chartShell}>
            {payload ? (
              <TradingChart
                ticker={ticker}
                series={mainSeries}
                fullSeries={historySeries}
                interval={interval}
                compareSeries={compareSeries}
                indicators={indicators}
                showVolume={hasRealVolume}
                percentScale={percentScale}
                logScale={logScale}
                height={chartHeight}
                drawTool={activeTool}
                clearDrawToken={clearDrawToken}
                undoApplyToken={undoApplyToken}
                undoApplyEntry={undoApplyEntry}
                resetZoomToken={resetZoomToken}
                seedDrawings={seedDrawings}
                drawingsSeedKey={drawingsSeedKey}
                onDrawingsChange={setDrawings}
                onSeedConsumed={() => setSeedDrawings(null)}
                onRecordUndo={(entry) => recordUndo(entry)}
                onBindUndoApi={(api) => {
                  chartUndoApiRef.current = api;
                }}
                onCrosshair={setOhlcLegend}
                onIntervalNote={setIntervalNote}
                onRemoveIndicator={(key) =>
                  setIndicatorsWithUndo((prev) => ({ ...prev, [key]: false }))
                }
              />
            ) : loading ? (
              <div className={styles.empty}>{t("charts.loadingChart")}</div>
            ) : (
              <div className={styles.empty} role="status">
                <strong style={{ color: "var(--tv-text)" }}>{t("charts.errors.seriesTitle")}</strong>
                <span>{error ?? t("charts.errors.seriesBody")}</span>
              </div>
            )}
          </div>
          <div className={styles.footerNote}>
            {!embedded && (
              <Link href={`/actions/${ticker}`} className={styles.ficheLink}>
                {t("charts.footer.openSheet", { ticker })}
              </Link>
            )}
            {embedded && (
              <>
                <Link href={`/graphes?ticker=${ticker}`} className={styles.ficheLink}>
                  {t("charts.footer.openCharts")}
                </Link>
                <span className={styles.embeddedTickerHint}>
                  {t("charts.footer.switchSymbol", { symbol: payload?.ticker ?? ticker })}
                </span>
              </>
            )}
            <span>{chartSourceNote()}</span>
          </div>
          {payload?.analysis && !loading && !error && (
            <div className={styles.analysisRecap}>
              <AnalysisRecap
                kind="technical"
                signalLabel={displaySignalLabel(payload.analysis.signalLabel, labels)}
                signalColor={payload.analysis.signalColor}
                score={payload.analysis.technicalScore}
                confidence={labels.confidence(payload.analysis.confidence)}
                summary={truncateSummary(
                  t("charts.recap.reading", {
                    ticker: payload.ticker,
                    summary: chartSignalSummary(payload.analysis, locale, labels, t),
                  })
                )}
                lines={chartTechnicalLines(
                  {
                    technical: payload.analysis.technical,
                    technicalScore: payload.analysis.technicalScore,
                  },
                  locale,
                  format,
                  labels,
                  t
                )}
                href={embedded ? undefined : `/actions/${ticker}`}
                hrefLabel={t("charts.recap.sheetLink")}
              />
            </div>
          )}
        </div>
      </div>

      {(showWatchlist || showIndicators || showCompare || showIntervalMenu) && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t("common.close")}
          onClick={() => {
            setShowWatchlist(false);
            setShowIndicators(false);
            setShowCompare(false);
            setShowIntervalMenu(false);
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  up,
  title,
}: {
  label: string;
  value: string;
  up?: boolean;
  title?: string;
}) {
  return (
    <div className={styles.metric} title={title}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue} style={up === undefined ? undefined : { color: up ? "#26a69a" : "#ef5350" }}>
        {value}
      </div>
    </div>
  );
}

