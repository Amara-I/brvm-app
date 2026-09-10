"use client";

// Workbench graphique OuestBourse — /graphes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  normalizeTo100,
  rangeFilter,
  type ChartClosePoint,
  type ChartRange,
} from "@/lib/charts/indicators";
import { CANDLE_INTERVALS, type CandleInterval } from "@/lib/charts/ohlc-aggregate";
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
import PortfolioTickerAction from "@/components/portfolio/PortfolioTickerAction";
import { C } from "@/lib/theme/colors";
import { technicalRecapLines, truncateSummary } from "@/lib/calc/analysis-recap";
import type { TechnicalSnapshot } from "@/lib/charts/technical-indicators";
import type { ChartDrawing } from "@/lib/charts/chart-drawings-storage";
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
    seriesEnriched?: boolean;
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
}

const RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: "1J", label: "1J" },
  { key: "5J", label: "5J" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "YTD", label: "YTD" },
  { key: "1A", label: "1A" },
  { key: "5A", label: "5A" },
  { key: "MAX", label: "Tout" },
];

const COMPARE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6"];

const DRAW_TOOLS: Array<{ id: DrawToolId; label: string; short: string; icon: string }> = [
  { id: "cross", label: "Curseur", short: "Curseur", icon: "+" },
  { id: "zoom", label: "Zoom zone (glisser)", short: "Zoom", icon: "⌕" },
  { id: "trend", label: "Tendance (2 clics)", short: "Tendance", icon: "/" },
  { id: "measure", label: "Mesure % (2 clics, flèche)", short: "Mesure", icon: "⇅" },
  { id: "horiz", label: "Ligne horizontale", short: "Horiz.", icon: "—" },
  { id: "fib", label: "Fibonacci (intervalle + 2×2 Ext)", short: "Fib", icon: "φ" },
  { id: "undo", label: "Annuler la dernière action (Ctrl+Z)", short: "Annuler", icon: "↶" },
  { id: "trash", label: "Effacer les tracés", short: "Effacer", icon: "⌫" },
];

const INDICATOR_OPTS: Array<{ key: keyof ChartIndicatorsState; label: string }> = [
  { key: "sma10", label: "SMA 10" },
  { key: "sma20", label: "SMA 20" },
  { key: "sma50", label: "SMA 50" },
  { key: "sma200", label: "SMA 200" },
  { key: "ema12", label: "EMA 12" },
  { key: "ema26", label: "EMA 26" },
  { key: "bollinger", label: "Bollinger (20,2)" },
  { key: "rsi", label: "RSI 14" },
  { key: "macd", label: "MACD (12,26,9)" },
  { key: "adx", label: "ADX / +DI / −DI (14)" },
  { key: "stochastic", label: "Stochastique (14,3)" },
  { key: "williamsR", label: "Williams %R (14)" },
  { key: "cci", label: "CCI (20)" },
  { key: "obv", label: "OBV (flux cumulé)" },
  { key: "volumeFlow", label: "Flux volume / SMA20" },
];

export default function ChartWorkbench({
  universe,
  initialTicker,
  embedded = false,
  isAuthenticated = false,
}: {
  universe: ChartUniverseItem[];
  initialTicker: string;
  /** Sur fiche société : masque le lien « Ouvrir la fiche » (déjà sur place). */
  embedded?: boolean;
  /** Compte actif — active la sauvegarde cloud des analyses. */
  isAuthenticated?: boolean;
}) {
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
  const [payload, setPayload] = useState<ChartApiPayload | null>(null);
  const [compareData, setCompareData] = useState<Record<string, ChartClosePoint[]>>({});
  const [loading, setLoading] = useState(true);
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

  const loadTicker = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      // Sans `cache: "no-store"` : le navigateur peut réutiliser la réponse
      // (Cache-Control s-maxage côté API) au lieu de relancer Sika/Rich.
      const res = await fetch(`/api/charts/${t}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Échec de chargement");
      setPayload(json.data as ChartApiPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTicker(ticker);
  }, [ticker, loadTicker]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompare() {
      const next: Record<string, ChartClosePoint[]> = {};
      await Promise.all(
        compare.map(async (t) => {
          try {
            const res = await fetch(`/api/charts/${t}`);
            const json = await res.json();
            if (json.ok) next[t] = (json.data as ChartApiPayload).series;
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
  }, [compare]);

  const mainSeries = useMemo(() => {
    if (!payload) return [];
    let pts = rangeFilter(payload.series, range);
    if (percentScale) pts = normalizeTo100(pts);
    return pts;
  }, [payload, range, percentScale]);

  const hasRealVolume = useMemo(
    () => (payload?.series ?? []).some((p) => typeof p.volume === "number" && p.volume > 0),
    [payload]
  );

  const compareSeries = useMemo(() => {
    if (!percentScale && compare.length === 0) return [];
    return compare
      .map((t, i) => {
        const raw = compareData[t];
        if (!raw) return null;
        let pts = rangeFilter(raw, range);
        if (percentScale) pts = normalizeTo100(pts);
        return { id: t, color: COMPARE_COLORS[i % COMPARE_COLORS.length]!, points: pts };
      })
      .filter(Boolean) as Array<{ id: string; color: string; points: ChartClosePoint[] }>;
  }, [compare, compareData, range, percentScale]);

  function selectTicker(t: string) {
    const next = t.toUpperCase();
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
            .filter((t) => universe.some((u) => u.ticker === t) && t !== nextTicker)
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

  function toggleCompare(t: string) {
    setCompare((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3 || t === ticker) return prev;
      return [...prev, t];
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
    const volTxt =
      last.volume && last.volume > 0 ? ` Vol ${last.volume.toLocaleString("fr-FR")}` : " Vol N/D";
    return `O ${fmt(prev.value)} H ${fmt(Math.max(prev.value, last.value))} L ${fmt(Math.min(prev.value, last.value))} C ${fmt(last.value)} ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%${volTxt}`;
  }, [mainSeries]);

  const intervalLabel = CANDLE_INTERVALS.find((i) => i.key === interval)?.label ?? "1j";

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
            title="Changer de titre"
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
                  placeholder="Rechercher ticker ou nom…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  aria-label="Rechercher une société"
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
            {stats?.lastClose != null ? `${stats.lastClose.toLocaleString("fr-FR")} FCFA` : "N/D"}
          </div>
          <div className={styles.dayChange} style={{ color: priceUp ? "#26a69a" : "#ef5350" }}>
            {stats?.dayChangeAbs != null && stats.dayChangePercent != null
              ? `${stats.dayChangeAbs >= 0 ? "+" : ""}${stats.dayChangeAbs.toLocaleString("fr-FR")} (${stats.dayChangePercent >= 0 ? "+" : ""}${stats.dayChangePercent}%)`
              : "N/D"}
            <span className={styles.marketStatus}> · aujourd&apos;hui{marketOpenHint()}</span>
          </div>
        </div>

        <div className={styles.metrics}>
          <Metric label="Variation 1A" value={fmtPct(stats?.change1YPercent)} up={(stats?.change1YPercent ?? 0) >= 0} />
          <Metric
            label="Volume"
            value={stats?.lastVolume != null && stats.lastVolume > 0 ? stats.lastVolume.toLocaleString("fr-FR") : "N/D"}
          />
          <Metric
            label="Capitalisation"
            value={fund?.mktCapMds != null && fund.mktCapMds > 0 ? `${fund.mktCapMds.toLocaleString("fr-FR")} Md` : "N/D"}
          />
          <Metric label="P/E" value={fund?.per != null && fund.per > 0 ? fund.per.toFixed(1).replace(".", ",") : "N/D"} />
          <Metric
            label="Dividende"
            value={
              fund?.dividendYieldPercent != null && fund.dividendYieldPercent > 0
                ? `${Number(fund.dividendYieldPercent).toFixed(1).replace(".", ",")}%`
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
              label: payload?.analysis?.signalLabel ?? "CONSERVER",
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
            Dernière analyse « <strong>{activeSavedAnalysis.name}</strong> » chargée
            {activeSavedAnalysis.updatedAt
              ? ` · ${new Date(activeSavedAnalysis.updatedAt).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
            .
          </span>
          <button
            type="button"
            className={styles.savedAnalysisBannerBtn}
            onClick={() => setAnalysisPanelOpen(true)}
          >
            Choisir une autre analyse
          </button>
        </div>
      ) : isAuthenticated && savedAnalysesCount === 0 ? (
        <div className={styles.savedAnalysisHint} role="note">
          <span>
            Enregistrez vos tracés et indicateurs via <strong>Mes analyses</strong> (en haut à
            droite) pour les retrouver à la prochaine ouverture de ce titre.
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
              title="Durée des bougies"
              aria-expanded={showIntervalMenu}
            >
              {intervalLabel} ▾
            </button>
            {showIntervalMenu && (
              <div className={styles.dropdown}>
                {CANDLE_INTERVALS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={interval === opt.key ? styles.dropItemActive : styles.dropItemBtn}
                    title={opt.title}
                    onClick={() => {
                      setInterval(opt.key);
                      setShowIntervalMenu(false);
                    }}
                  >
                    {opt.label} — {opt.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={styles.candleIcon} title="Chandeliers">
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
              Indicateurs {indicatorCount > 0 ? <span className={styles.badge}>{indicatorCount}</span> : null}
            </button>
            {showIndicators && (
              <div className={styles.dropdown}>
                {INDICATOR_OPTS.map((opt) => (
                  <label key={opt.key} className={styles.dropItem}>
                    <input
                      type="checkbox"
                      checked={indicators[opt.key]}
                      onChange={(e) =>
                        setIndicatorsWithUndo((prev) => ({
                          ...prev,
                          [opt.key]: e.target.checked,
                        }))
                      }
                    />
                    {opt.label}
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
              Comparer
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
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? styles.rangeActive : styles.rangeBtn}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              title={`Plage ${r.label}`}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className={percentScale ? styles.toolChipOn : styles.toolChip}
            onClick={() => setPercentScale((v) => !v)}
            aria-pressed={percentScale}
            title="Échelle en %"
          >
            <span className={styles.toolChipGlyph}>%</span>
            <span className={styles.toolChipLabel}>Pourcent</span>
          </button>
          <button
            type="button"
            className={logScale ? styles.toolChipOn : styles.toolChip}
            onClick={() => setLogScale((v) => !v)}
            aria-pressed={logScale}
            title="Échelle logarithmique"
          >
            <span className={styles.toolChipGlyph}>log</span>
            <span className={styles.toolChipLabel}>Log</span>
          </button>
          <button
            type="button"
            className={styles.toolChip}
            onClick={() => {
              setPercentScale(false);
              setLogScale(false);
              setResetZoomToken((n) => n + 1);
            }}
            title="Échelle auto + afficher tout le graphique"
          >
            <span className={styles.toolChipGlyph}>auto</span>
            <span className={styles.toolChipLabel}>Auto</span>
          </button>
          <button
            type="button"
            className={fullscreen ? styles.toolChipExit : styles.toolChip}
            onClick={() => setFullscreen((v) => !v)}
            aria-pressed={fullscreen}
            title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            <span className={styles.toolChipGlyph}>{fullscreen ? "✕" : "⛶"}</span>
            <span className={styles.toolChipLabel}>{fullscreen ? "Réduire" : "Plein écran"}</span>
          </button>
        </div>
      </div>

      <div className={styles.chartRow}>
        <aside className={styles.drawRail} aria-label="Outils d'analyse graphique">
          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={activeTool === t.id ? styles.railBtnActive : styles.railBtn}
              title={t.label}
              aria-label={t.label}
              aria-pressed={activeTool === t.id}
              onClick={() => onToolClick(t.id)}
            >
              <span className={styles.railIcon}>{t.icon}</span>
              <span className={styles.railLabel}>{t.short}</span>
            </button>
          ))}
        </aside>

        <div className={styles.chartCol}>
          <div className={styles.legendBar}>{ohlcLegend ?? defaultLegend ?? "—"}</div>
          {intervalNote && <div className={styles.intervalNote}>{intervalNote}</div>}
          <div className={styles.chartShell}>
            {loading ? (
              <div className={styles.empty}>Chargement du graphique…</div>
            ) : error ? (
              <div className={styles.empty}>{error}</div>
            ) : (
              <TradingChart
                ticker={ticker}
                series={mainSeries}
                fullSeries={payload?.series ?? []}
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
            )}
          </div>
          <div className={styles.footerNote}>
            {!embedded && (
              <Link href={`/actions/${ticker}`} className={styles.ficheLink}>
                Ouvrir la fiche {ticker} →
              </Link>
            )}
            {embedded && (
              <>
                <Link href={`/graphes?ticker=${ticker}`} className={styles.ficheLink}>
                  Ouvrir en page Graphes →
                </Link>
                <span className={styles.embeddedTickerHint}>
                  · Cliquez sur le ticker ({payload?.ticker ?? ticker} ▾) pour changer de société
                </span>
              </>
            )}
            <span>
              Source : {payload?.stats.source ?? "N/D"} · {payload?.stats.points ?? 0} points
              {payload?.stats.seriesEnriched
                ? ` (densifié${
                    payload.stats.reconciliation?.densifySources?.length
                      ? ` · ${payload.stats.reconciliation.densifySources.join(" + ")}`
                      : ""
                  })`
                : ""}
              {payload?.stats.reconciliation &&
              payload.stats.reconciliation.discrepanciesCount > 0
                ? ` · ${payload.stats.reconciliation.discrepanciesCount} écart(s) > ${payload.stats.reconciliation.thresholdPercent}% écartés (priorité BRVM > Sika > Rich)`
                : payload?.stats.seriesEnriched
                  ? " · croisement multi-source OK"
                  : ""}{" "}
              · Volume {hasRealVolume ? "réel" : "N/D"} · OHLC synthétique si open/high/low absents
            </span>
          </div>
          {payload?.analysis && !loading && !error && (
            <div className={styles.analysisRecap}>
              <AnalysisRecap
                kind="technical"
                signalLabel={payload.analysis.signalLabel}
                signalColor={payload.analysis.signalColor}
                score={payload.analysis.technicalScore}
                confidence={payload.analysis.confidence}
                summary={truncateSummary(
                  `Lecture graphique de ${payload.ticker} — ${payload.analysis.signalSummary}`
                )}
                lines={technicalRecapLines({
                  technical: payload.analysis.technical,
                  technicalScore: payload.analysis.technicalScore,
                })}
                href={embedded ? undefined : `/actions/${ticker}`}
                hrefLabel="Fiche société & signal →"
              />
            </div>
          )}
        </div>
      </div>

      {(showWatchlist || showIndicators || showCompare || showIntervalMenu) && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Fermer"
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

function Metric({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue} style={up === undefined ? undefined : { color: up ? "#26a69a" : "#ef5350" }}>
        {value}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "N/D";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;
}

function marketOpenHint(): string {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return " — Marché fermé";
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (mins >= 9 * 60 + 30 && mins <= 14 * 60 + 30) return " — Marché ouvert";
  return " — Marché fermé";
}
