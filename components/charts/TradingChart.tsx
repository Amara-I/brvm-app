"use client";

// Graphique chandeliers OuestBourse (lightweight-charts, sans logo TradingView).

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import { computeSma, type ChartClosePoint } from "@/lib/charts/indicators";
import { type CandleInterval } from "@/lib/charts/ohlc-aggregate";
import {
  computeAdxSeries,
  computeBollinger,
  computeCciSeries,
  computeEmaPoints,
  computeMacdSeries,
  computeObv,
  computeRsiSeries,
  computeStochasticSeries,
  computeVolumeFlow,
  computeWilliamsRSeries,
} from "@/lib/charts/chart-indicators";
import { clipPointsToRange } from "@/lib/charts/indicator-lookback";
import { alignSeriesToInterval, buildSyncedChartView } from "@/lib/charts/synced-chart-view";
import { computeBottomPaneLayout } from "@/lib/charts/bottom-pane-layout";
import {
  loadChartDrawings,
  newDrawingId,
  saveChartDrawings,
  formatMeasureLabel,
  getFibBounds,
  type ChartDrawing,
} from "@/lib/charts/chart-drawings-storage";
import {
  FIB_DISPLAY_LEVELS,
  fibPriceAtLevel,
  formatFibLevel,
  isFibExtensionLevel,
} from "@/lib/charts/fib-levels";
import {
  cloneDrawings,
  cloneZoom,
  type ChartViewUndoEntry,
  type ZoomSnap,
} from "@/lib/charts/chart-undo";
import styles from "./TradingChart.module.css";

export type { ChartViewUndoEntry, ZoomSnap };

const TV = {
  bg: "#131722",
  grid: "#1e222d",
  text: "#d1d4dc",
  textDim: "#787b86",
  border: "#2a2e39",
  green: "#26a69a",
  red: "#ef5350",
  sma: "#f5a623",
  ema: "#42a5f5",
  bb: "#7e57c2",
  cross: "#758696",
  rsi: "#ab47bc",
  macd: "#26c6da",
  signal: "#ef6c00",
  obv: "#66bb6a",
  adx: "#ffca28",
  plusDi: "#26a69a",
  minusDi: "#ef5350",
  stochK: "#42a5f5",
  stochD: "#ff7043",
  williams: "#ec407a",
  cci: "#26a69a",
  measureUp: "#26a69a",
  measureDown: "#ef5350",
  fib: "rgba(245,166,35,0.75)",
  fibExt: "rgba(255,152,0,0.85)",
};

export interface ChartIndicatorsState {
  sma10: boolean;
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema12: boolean;
  ema26: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  obv: boolean;
  volumeFlow: boolean;
  /** Average Directional Index (+DI/−DI) — Guide BRVM. */
  adx: boolean;
  /** Stochastique %K/%D. */
  stochastic: boolean;
  /** Williams %R. */
  williamsR: boolean;
  /** Commodity Channel Index. */
  cci: boolean;
}

export type DrawToolId =
  | "cross"
  | "zoom"
  | "trend"
  | "horiz"
  | "fib"
  | "measure"
  | "undo"
  | "trash";

type OverlayHandle = {
  drawingId: string;
  endpoint: "a" | "b" | "high" | "low" | "price";
  left: number;
  top: number;
};

type MeasureBadge = {
  id: string;
  left: number;
  top: number;
  text: string;
  up: boolean;
};

export type IndicatorOverlayKey = keyof ChartIndicatorsState;

export interface IndicatorOverlayChip {
  key: IndicatorOverlayKey;
  label: string;
  color: string;
}

export interface TradingChartProps {
  /** Ticker pour persister les tracés (localStorage) entre les visites. */
  ticker: string;
  /** Série affichée (déjà filtrée par plage, éventuellement en %). */
  series: ChartClosePoint[];
  /**
   * Historique absolu non filtré — sert au lookback des SMA/EMA/…
   * pour que les moyennes couvrent toute la période visible.
   */
  fullSeries?: ChartClosePoint[];
  interval?: CandleInterval;
  compareSeries?: Array<{ id: string; color: string; points: ChartClosePoint[] }>;
  indicators?: ChartIndicatorsState;
  showVolume?: boolean;
  percentScale?: boolean;
  logScale?: boolean;
  height?: number;
  drawTool?: DrawToolId;
  clearDrawToken?: number;
  /**
   * Incrémente pour appliquer `undoApplyEntry` (tracés/zoom),
   * ou annuler un 1er clic tendance si `undoApplyEntry` est null.
   */
  undoApplyToken?: number;
  undoApplyEntry?: ChartViewUndoEntry | null;
  /** Enregistre l'état AVANT une mutation (pour Annuler / Ctrl+Z). */
  onRecordUndo?: (entry: ChartViewUndoEntry) => void;
  /** API pour savoir s'il y a un tracé en cours (1er clic tendance). */
  onBindUndoApi?: (api: { hasPendingTrend: () => boolean } | null) => void;
  /** Incrémente pour réafficher tout le graphique (sortie de zoom). */
  resetZoomToken?: number;
  onCrosshair?: (legend: string | null) => void;
  onIntervalNote?: (note: string | null) => void;
  /** Retire un indicateur superposé (clic / clic droit sur sa pastille). */
  onRemoveIndicator?: (key: IndicatorOverlayKey) => void;
  /**
   * Tracés à charger (ex. analyse cloud). Si fourni avec `drawingsSeedKey`,
   * remplace le chargement localStorage pour ce montage.
   */
  seedDrawings?: ChartDrawing[] | null;
  /** Incrémente pour forcer le rechargement de `seedDrawings`. */
  drawingsSeedKey?: number;
  /** Notifie le parent à chaque mutation de tracés (sauvegarde cloud). */
  onDrawingsChange?: (drawings: ChartDrawing[]) => void;
  /** Appelé après application d'un `seedDrawings` (pour libérer le seed côté parent). */
  onSeedConsumed?: () => void;
}

const DEFAULT_INDICATORS: ChartIndicatorsState = {
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

export default function TradingChart({
  ticker,
  series,
  fullSeries,
  interval = "1D",
  compareSeries = [],
  indicators = DEFAULT_INDICATORS,
  showVolume = true,
  percentScale = false,
  logScale = false,
  height = 560,
  drawTool = "cross",
  clearDrawToken = 0,
  undoApplyToken = 0,
  undoApplyEntry = null,
  onRecordUndo,
  onBindUndoApi,
  resetZoomToken = 0,
  onCrosshair,
  onIntervalNote,
  onRemoveIndicator,
  seedDrawings = null,
  drawingsSeedKey = 0,
  onDrawingsChange,
  onSeedConsumed,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  /** 1er point en attente pour tendance / fib / mesure. */
  const twoPointStartRef = useRef<{ time: Time; price: number } | null>(null);
  /** Dispose callbacks alignés 1:1 avec drawingsDataRef. */
  const disposeFnsRef = useRef<Array<() => void>>([]);
  const drawingsDataRef = useRef<ChartDrawing[]>([]);
  const tickerRef = useRef(ticker);
  const drawToolRef = useRef(drawTool);
  const visibleRangeRef = useRef<{ from: number; to: number } | null>(null);
  const priceZoomRef = useRef<{ min: number; max: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleDragRef = useRef<{
    drawingId: string;
    endpoint: OverlayHandle["endpoint"];
    moved: boolean;
  } | null>(null);
  const syncOverlaysRef = useRef<() => void>(() => {});
  const reapplyDrawingsRef = useRef<() => void>(() => {});
  const onRecordUndoRef = useRef(onRecordUndo);
  const undoApplyEntryRef = useRef(undoApplyEntry);
  const [overlayChips, setOverlayChips] = useState<IndicatorOverlayChip[]>([]);
  const [overlayHandles, setOverlayHandles] = useState<OverlayHandle[]>([]);
  const [measureBadges, setMeasureBadges] = useState<MeasureBadge[]>([]);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null
  );

  drawToolRef.current = drawTool;
  onRecordUndoRef.current = onRecordUndo;
  undoApplyEntryRef.current = undoApplyEntry;

  useEffect(() => {
    // Changer d'outil annule le 1er clic en attente (tendance / fib / mesure).
    twoPointStartRef.current = null;
  }, [drawTool]);

  useEffect(() => {
    onBindUndoApi?.({
      hasPendingTrend: () => twoPointStartRef.current != null,
    });
    return () => onBindUndoApi?.(null);
  }, [onBindUndoApi]);

  const seriesKey = `${ticker}|${interval}|${series[0]?.time ?? ""}|${series[series.length - 1]?.time ?? ""}|${series.length}`;

  // Nouvelle série / ticker / intervalle → repartir du zoom global
  useEffect(() => {
    visibleRangeRef.current = null;
    priceZoomRef.current = null;
  }, [seriesKey]);

  const onDrawingsChangeRef = useRef(onDrawingsChange);
  onDrawingsChangeRef.current = onDrawingsChange;
  const onSeedConsumedRef = useRef(onSeedConsumed);
  onSeedConsumedRef.current = onSeedConsumed;
  const seedDrawingsRef = useRef(seedDrawings);
  seedDrawingsRef.current = seedDrawings;

  function persistDrawings(next: ChartDrawing[]) {
    drawingsDataRef.current = next;
    saveChartDrawings(tickerRef.current, next);
    onDrawingsChangeRef.current?.(cloneDrawings(next));
  }

  // Charger les tracés (seed cloud ou localStorage) pour ce ticker
  useEffect(() => {
    tickerRef.current = ticker;
    const fromSeed = seedDrawingsRef.current;
    const seeded =
      fromSeed != null ? cloneDrawings(fromSeed) : loadChartDrawings(ticker);
    drawingsDataRef.current = seeded;
    twoPointStartRef.current = null;
    disposeFnsRef.current = [];
    if (fromSeed != null) {
      // Synchroniser le cache navigateur pour les remounts après libération du seed.
      saveChartDrawings(ticker, seeded);
      onDrawingsChangeRef.current?.(cloneDrawings(seeded));
      onSeedConsumedRef.current?.();
    } else {
      onDrawingsChangeRef.current?.(cloneDrawings(seeded));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, drawingsSeedKey]);

  function currentZoomSnap(): ZoomSnap {
    return {
      range: visibleRangeRef.current ? { ...visibleRangeRef.current } : null,
      price: priceZoomRef.current ? { ...priceZoomRef.current } : null,
    };
  }

  function recordDrawingsUndo() {
    onRecordUndoRef.current?.({
      type: "drawings",
      drawings: cloneDrawings(drawingsDataRef.current),
    });
  }

  function recordZoomUndo() {
    onRecordUndoRef.current?.({
      type: "zoom",
      zoom: cloneZoom(currentZoomSnap()),
    });
  }

  // Effacer tous les tracés (bouton ⌫) + persistance
  useEffect(() => {
    if (clearDrawToken <= 0) return;
    if (drawingsDataRef.current.length > 0 || twoPointStartRef.current) {
      recordDrawingsUndo();
    }
    for (const dispose of disposeFnsRef.current) dispose();
    disposeFnsRef.current = [];
    drawingsDataRef.current = [];
    twoPointStartRef.current = null;
    persistDrawings([]);
    setOverlayHandles([]);
    setMeasureBadges([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDrawToken]);

  function clearPriceZoom(seriesApi: ISeriesApi<"Candlestick">) {
    seriesApi.applyOptions({ autoscaleInfoProvider: undefined });
    seriesApi.priceScale().applyOptions({ autoScale: true });
  }

  function applyZoomSnap(zoom: ZoomSnap) {
    visibleRangeRef.current = zoom.range;
    priceZoomRef.current = zoom.price;
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;
    if (zoom.price) {
      const { min, max } = zoom.price;
      candle.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: min, maxValue: max },
        }),
      });
      candle.priceScale().applyOptions({ autoScale: true });
    } else {
      clearPriceZoom(candle);
    }
    if (zoom.range) {
      chart.timeScale().setVisibleLogicalRange(zoom.range);
    } else {
      chart.timeScale().fitContent();
    }
  }

  function replaceDrawings(next: ChartDrawing[]) {
    persistDrawings(next);
    reapplyDrawingsRef.current();
  }

  // Annuler : restaurer tracés/zoom, ou annuler le 1er clic tendance
  useEffect(() => {
    if (undoApplyToken <= 0) return;
    if (twoPointStartRef.current) {
      twoPointStartRef.current = null;
      return;
    }
    const entry = undoApplyEntryRef.current;
    if (!entry) return;
    if (entry.type === "drawings") {
      replaceDrawings(cloneDrawings(entry.drawings));
      return;
    }
    if (entry.type === "zoom") {
      applyZoomSnap(cloneZoom(entry.zoom));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoApplyToken]);

  function resetZoomView(record = true) {
    const hasZoom = visibleRangeRef.current != null || priceZoomRef.current != null;
    if (record && hasZoom) recordZoomUndo();
    visibleRangeRef.current = null;
    priceZoomRef.current = null;
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;
    clearPriceZoom(candle);
    chart.timeScale().fitContent();
  }

  useEffect(() => {
    if (resetZoomToken <= 0) return;
    resetZoomView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetZoomToken]);

  // Pendant le zoom zone : ne pas faire défiler le graphique au drag
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const zooming = drawTool === "zoom";
    chart.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: !zooming,
        horzTouchDrag: !zooming,
        vertTouchDrag: !zooming,
      },
      handleScale: {
        axisPressedMouseMove: !zooming,
        mouseWheel: true,
        pinch: true,
      },
    });
  }, [drawTool]);

  function applyMarqueeZoom(x0: number, y0: number, x1: number, y1: number) {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;

    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    if (right - left < 16 || bottom - top < 16) return;

    const fromLogical = chart.timeScale().coordinateToLogical(left);
    const toLogical = chart.timeScale().coordinateToLogical(right);
    if (fromLogical == null || toLogical == null) return;

    const from = Math.min(fromLogical, toLogical);
    const to = Math.max(fromLogical, toLogical);
    if (to - from < 1) return;

    recordZoomUndo();

    visibleRangeRef.current = { from, to };
    chart.timeScale().setVisibleLogicalRange({ from, to });

    const pTop = candle.coordinateToPrice(top);
    const pBot = candle.coordinateToPrice(bottom);
    if (pTop != null && pBot != null) {
      const min = Math.min(pTop, pBot);
      const max = Math.max(pTop, pBot);
      if (max > min) {
        priceZoomRef.current = { min, max };
        candle.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: min, maxValue: max },
          }),
        });
        candle.priceScale().applyOptions({ autoScale: true });
      }
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    const visibleFrom = series[0]!.time;
    const visibleTo = series[series.length - 1]!.time;

    function requiredLookback(ind: ChartIndicatorsState): number {
      let n = 2;
      if (ind.sma10) n = Math.max(n, 10);
      if (ind.sma20) n = Math.max(n, 20);
      if (ind.sma50) n = Math.max(n, 50);
      if (ind.sma200) n = Math.max(n, 200);
      if (ind.ema12) n = Math.max(n, 12);
      if (ind.ema26) n = Math.max(n, 26);
      if (ind.bollinger) n = Math.max(n, 20);
      if (ind.rsi) n = Math.max(n, 15);
      if (ind.macd) n = Math.max(n, 35);
      if (ind.obv || ind.volumeFlow) n = Math.max(n, 20);
      if (ind.adx) n = Math.max(n, 40);
      if (ind.stochastic) n = Math.max(n, 20);
      if (ind.williamsR) n = Math.max(n, 14);
      if (ind.cci) n = Math.max(n, 20);
      return n;
    }

    const history = fullSeries && fullSeries.length > 0 ? fullSeries : series;
    const view = buildSyncedChartView({
      fullPoints: history,
      visibleFrom,
      visibleTo,
      interval,
      lookbackBars: requiredLookback(indicators),
      percentScale,
    });
    onIntervalNote?.(view.note);
    const candles = view.candles;
    if (candles.length === 0) return;
    const closes = view.indicatorCloses;
    const indCandles = view.indicatorCandles;
    const candleFrom = candles[0]!.time;
    const candleTo = candles[candles.length - 1]!.time;

    function clipVisible(pts: ChartClosePoint[]): ChartClosePoint[] {
      return clipPointsToRange(pts, candleFrom, candleTo);
    }

    const showRsi = indicators.rsi;
    const showMacd = indicators.macd;
    const showAdx = indicators.adx;
    const showStoch = indicators.stochastic;
    const showWilliams = indicators.williamsR;
    const showCci = indicators.cci;
    const showObv = indicators.obv || indicators.volumeFlow;
    const bottomPanes =
      (showRsi ? 1 : 0) +
      (showMacd ? 1 : 0) +
      (showAdx ? 1 : 0) +
      (showStoch ? 1 : 0) +
      (showWilliams ? 1 : 0) +
      (showCci ? 1 : 0) +
      (showObv ? 1 : 0);
    const paneLayout = computeBottomPaneLayout({
      bottomPaneCount: bottomPanes,
      showVolume,
    });
    const { mainBottomMargin, paneMargins } = paneLayout;
    let paneIndex = 0;
    const nextPaneMargins = () => paneMargins(paneIndex++);

    const chart = createChart(el, {
      width: el.clientWidth || 900,
      height,
      layout: {
        background: { type: ColorType.Solid, color: TV.bg },
        textColor: TV.textDim,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: TV.grid },
        horzLines: { color: TV.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV.cross, width: 1, style: 2, labelBackgroundColor: TV.border },
        horzLine: { color: TV.cross, width: 1, style: 2, labelBackgroundColor: TV.border },
      },
      rightPriceScale: {
        borderColor: TV.border,
        mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        scaleMargins: {
          top: 0.06,
          bottom: mainBottomMargin,
        },
      },
      timeScale: {
        borderColor: TV.border,
        timeVisible: interval === "1H",
        secondsVisible: false,
        rightOffset: 4,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: drawToolRef.current !== "zoom",
        horzTouchDrag: drawToolRef.current !== "zoom",
        vertTouchDrag: drawToolRef.current !== "zoom",
      },
      handleScale: {
        axisPressedMouseMove: drawToolRef.current !== "zoom",
        mouseWheel: true,
        pinch: true,
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: TV.green,
      downColor: TV.red,
      borderUpColor: TV.green,
      borderDownColor: TV.red,
      wickUpColor: TV.green,
      wickDownColor: TV.red,
      priceLineVisible: true,
      lastValueVisible: true,
      priceScaleId: "right",
      priceFormat: percentScale
        ? { type: "percent" }
        : { type: "price", precision: 0, minMove: 1 },
    });
    candleRef.current = candleSeries;

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    function applyAutoscaleWithDrawings() {
      // Les tracés (fib inclus) ne doivent PAS élargir l'échelle :
      // seules les bougies / un zoom manuel utilisateur pilotent le scaling.
      if (priceZoomRef.current) {
        const { min, max } = priceZoomRef.current;
        candleSeries.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: min, maxValue: max },
          }),
        });
        return;
      }
      candleSeries.applyOptions({ autoscaleInfoProvider: undefined });
    }

    function syncOverlays() {
      const chartApi = chartRef.current;
      const seriesApi = candleRef.current;
      if (!chartApi || !seriesApi) {
        setOverlayHandles([]);
        setMeasureBadges([]);
        return;
      }
      const handles: OverlayHandle[] = [];
      const badges: MeasureBadge[] = [];
      for (const drawing of drawingsDataRef.current) {
        if (drawing.type === "horiz") {
          const y = seriesApi.priceToCoordinate(drawing.price);
          if (y == null) continue;
          handles.push({ drawingId: drawing.id, endpoint: "price", left: 18, top: y });
          continue;
        }
        if (drawing.type === "fib") {
          if ("p1" in drawing && "t1" in drawing) {
            const x1 = chartApi.timeScale().timeToCoordinate(drawing.t1 as Time);
            const y1 = seriesApi.priceToCoordinate(drawing.p1);
            const x2 = chartApi.timeScale().timeToCoordinate(drawing.t2 as Time);
            const y2 = seriesApi.priceToCoordinate(drawing.p2);
            if (x1 != null && y1 != null) {
              handles.push({ drawingId: drawing.id, endpoint: "a", left: x1, top: y1 });
            }
            if (x2 != null && y2 != null) {
              handles.push({ drawingId: drawing.id, endpoint: "b", left: x2, top: y2 });
            }
          } else {
            const { high, low } = getFibBounds(drawing);
            const yH = seriesApi.priceToCoordinate(high);
            const yL = seriesApi.priceToCoordinate(low);
            if (yH != null) handles.push({ drawingId: drawing.id, endpoint: "high", left: 28, top: yH });
            if (yL != null) handles.push({ drawingId: drawing.id, endpoint: "low", left: 28, top: yL });
          }
          continue;
        }
        const x1 = chartApi.timeScale().timeToCoordinate(drawing.t1 as Time);
        const y1 = seriesApi.priceToCoordinate(drawing.p1);
        const x2 = chartApi.timeScale().timeToCoordinate(drawing.t2 as Time);
        const y2 = seriesApi.priceToCoordinate(drawing.p2);
        if (x1 != null && y1 != null) {
          handles.push({ drawingId: drawing.id, endpoint: "a", left: x1, top: y1 });
        }
        if (x2 != null && y2 != null) {
          handles.push({ drawingId: drawing.id, endpoint: "b", left: x2, top: y2 });
        }
        if (drawing.type === "measure" && x1 != null && y1 != null && x2 != null && y2 != null) {
          const label = formatMeasureLabel(drawing.p1, drawing.p2);
          badges.push({
            id: drawing.id,
            left: (x1 + x2) / 2,
            top: (y1 + y2) / 2,
            text: label.text,
            up: label.up,
          });
        }
      }
      setOverlayHandles(handles);
      setMeasureBadges(badges);
    }
    syncOverlaysRef.current = syncOverlays;

    function applyDrawing(drawing: ChartDrawing): () => void {
      if (drawing.type === "horiz") {
        const line = candleSeries.createPriceLine({
          price: drawing.price,
          color: "#2962ff",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: fmt(drawing.price),
        });
        return () => {
          try {
            candleSeries.removePriceLine(line);
          } catch {
            /* chart disposed */
          }
        };
      }
      if (drawing.type === "fib") {
        const { high, low } = getFibBounds(drawing);
        const lines = FIB_DISPLAY_LEVELS.map((lv) => {
          const p = fibPriceAtLevel(low, high, lv);
          const ext = isFibExtensionLevel(lv);
          return candleSeries.createPriceLine({
            price: p,
            color: ext ? TV.fibExt : TV.fib,
            lineWidth: 1,
            lineStyle: ext ? LineStyle.Dotted : LineStyle.Dashed,
            axisLabelVisible: true,
            title: formatFibLevel(lv),
          });
        });
        return () => {
          for (const line of lines) {
            try {
              candleSeries.removePriceLine(line);
            } catch {
              /* chart disposed */
            }
          }
        };
      }
      if (drawing.type === "measure") {
        const up = drawing.p2 >= drawing.p1;
        const color = up ? TV.measureUp : TV.measureDown;
        const label = formatMeasureLabel(drawing.p1, drawing.p2);
        const line = chart.addLineSeries({
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          priceScaleId: "right",
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData([
          { time: drawing.t1 as Time, value: drawing.p1 },
          { time: drawing.t2 as Time, value: drawing.p2 },
        ] as LineData[]);
        line.setMarkers([
          {
            time: drawing.t1 as Time,
            position: "inBar",
            color,
            shape: "circle",
            size: 1.5,
          },
          {
            time: drawing.t2 as Time,
            position: "inBar",
            color,
            shape: up ? "arrowUp" : "arrowDown",
            text: label.text,
            size: 2,
          },
        ]);
        return () => {
          try {
            chart.removeSeries(line);
          } catch {
            /* chart disposed */
          }
        };
      }
      const line = chart.addLineSeries({
        color: "#2962ff",
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData([
        { time: drawing.t1 as Time, value: drawing.p1 },
        { time: drawing.t2 as Time, value: drawing.p2 },
      ] as LineData[]);
      return () => {
        try {
          chart.removeSeries(line);
        } catch {
          /* chart disposed */
        }
      };
    }

    function commitDrawing(drawing: ChartDrawing) {
      recordDrawingsUndo();
      const dispose = applyDrawing(drawing);
      disposeFnsRef.current.push(dispose);
      persistDrawings([...drawingsDataRef.current, drawing]);
      applyAutoscaleWithDrawings();
      syncOverlays();
    }

    // Restaurer la session de tracés pour ce ticker
    disposeFnsRef.current = [];
    for (const drawing of drawingsDataRef.current) {
      disposeFnsRef.current.push(applyDrawing(drawing));
    }
    applyAutoscaleWithDrawings();
    reapplyDrawingsRef.current = () => {
      for (const dispose of disposeFnsRef.current) dispose();
      disposeFnsRef.current = [];
      for (const drawing of drawingsDataRef.current) {
        disposeFnsRef.current.push(applyDrawing(drawing));
      }
      applyAutoscaleWithDrawings();
      syncOverlays();
    };

    const chips: IndicatorOverlayChip[] = [];

    function addSma(period: number, color: string, enabled: boolean, key: IndicatorOverlayKey) {
      if (!enabled || closes.length < period) return;
      const pts = clipVisible(computeSma(closes, period));
      if (pts.length === 0) return;
      const s = chart.addLineSeries({
        color,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: true,
        title: `SMA ${period}`,
      });
      s.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
      const last = pts[pts.length - 1];
      if (last) {
        chips.push({
          key,
          label: `SMA ${period} ${last.value.toLocaleString("fr-FR")}`,
          color,
        });
      }
    }

    addSma(10, "#42a5f5", indicators.sma10, "sma10");
    addSma(20, TV.sma, indicators.sma20, "sma20");
    addSma(50, "#ff7043", indicators.sma50, "sma50");
    addSma(200, "#90a4ae", indicators.sma200, "sma200");

    if (indicators.ema12 && closes.length >= 12) {
      const pts = clipVisible(computeEmaPoints(closes, 12));
      if (pts.length > 0) {
        const s = chart.addLineSeries({
          color: TV.ema,
          lineWidth: 1,
          priceScaleId: "right",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "EMA 12",
        });
        s.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        chips.push({ key: "ema12", label: "EMA 12", color: TV.ema });
      }
    }
    if (indicators.ema26 && closes.length >= 26) {
      const pts = clipVisible(computeEmaPoints(closes, 26));
      if (pts.length > 0) {
        const s = chart.addLineSeries({
          color: "#29b6f6",
          lineWidth: 1,
          priceScaleId: "right",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "EMA 26",
        });
        s.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        chips.push({ key: "ema26", label: "EMA 26", color: "#29b6f6" });
      }
    }

    if (indicators.bollinger && closes.length >= 20) {
      const bb = computeBollinger(closes, 20, 2);
      for (const [rawPts, color, title] of [
        [bb.upper, TV.bb, "BB+"] as const,
        [bb.mid, "#b39ddb", "BB mid"] as const,
        [bb.lower, TV.bb, "BB-"] as const,
      ]) {
        const pts = clipVisible(rawPts);
        if (pts.length === 0) continue;
        const s = chart.addLineSeries({
          color,
          lineWidth: 1,
          priceScaleId: "right",
          lineStyle: title === "BB mid" ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          title,
        });
        s.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
      }
      chips.push({ key: "bollinger", label: "Bollinger 20", color: TV.bb });
    }

    for (const cmp of compareSeries) {
      const aligned = alignSeriesToInterval(
        cmp.points,
        interval,
        visibleFrom,
        visibleTo,
        percentScale
      );
      if (aligned.length === 0) continue;
      const s = chart.addLineSeries({
        color: cmp.color,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: true,
        title: cmp.id,
      });
      s.setData(aligned.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
    }

    const hasRealVol = candles.some((c) => c.volume != null && c.volume > 0);
    if (showVolume && hasRealVol) {
      // Overlay volume (priceScaleId '') — ne JAMAIS partager l'échelle « right »
      // des cours, sinon un volume en millions écrase les bougies (pics aberrants).
      const vol = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("").applyOptions({
        scaleMargins: { top: 1 - paneLayout.volumeBand, bottom: 0 },
      });
      const hist: HistogramData[] = candles.map((c, i) => {
        const prev = i > 0 ? candles[i - 1]!.close : c.open;
        return {
          time: c.time as Time,
          value: c.volume && c.volume > 0 ? c.volume : 0,
          color: c.close >= prev ? "rgba(38,166,154,0.45)" : "rgba(239,83,80,0.45)",
        };
      });
      vol.setData(hist);
    }

    if (showRsi) {
      const rsiPts = clipVisible(computeRsiSeries(closes, 14));
      if (rsiPts.length) {
        const rsi = chart.addLineSeries({
          color: TV.rsi,
          lineWidth: 1,
          priceScaleId: "rsi",
          priceLineVisible: false,
          lastValueVisible: true,
          title: "RSI 14",
        });
        chart.priceScale("rsi").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        rsi.setData(rsiPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        rsi.createPriceLine({ price: 70, color: "rgba(239,83,80,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        rsi.createPriceLine({ price: 30, color: "rgba(38,166,154,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        chips.push({
          key: "rsi",
          label: `RSI ${rsiPts[rsiPts.length - 1]!.value}`,
          color: TV.rsi,
        });
      }
    }

    if (showMacd) {
      const m = computeMacdSeries(closes);
      const macdPts = clipVisible(m.macd);
      const sigPts = clipVisible(m.signal);
      const histPts = clipVisible(m.hist);
      if (histPts.length) {
        const histSeries = chart.addHistogramSeries({
          priceScaleId: "macd",
          priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        });
        chart.priceScale("macd").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        histSeries.setData(
          histPts.map((p) => ({
            time: p.time as Time,
            value: p.value,
            color: p.value >= 0 ? "rgba(38,166,154,0.55)" : "rgba(239,83,80,0.55)",
          })) as HistogramData[]
        );
        const macdLine = chart.addLineSeries({
          color: TV.macd,
          lineWidth: 1,
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "MACD",
        });
        macdLine.setData(macdPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        const sigLine = chart.addLineSeries({
          color: TV.signal,
          lineWidth: 1,
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "Signal",
        });
        sigLine.setData(sigPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        chips.push({ key: "macd", label: "MACD", color: TV.macd });
      }
    }

    if (showAdx) {
      const a = computeAdxSeries(indCandles, 14);
      const adxPts = clipVisible(a.adx);
      const plusPts = clipVisible(a.plusDi);
      const minusPts = clipVisible(a.minusDi);
      if (adxPts.length) {
        chart.priceScale("adx").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        const adxLine = chart.addLineSeries({
          color: TV.adx,
          lineWidth: 2,
          priceScaleId: "adx",
          priceLineVisible: false,
          lastValueVisible: true,
          title: "ADX",
        });
        adxLine.setData(adxPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        const plusLine = chart.addLineSeries({
          color: TV.plusDi,
          lineWidth: 1,
          priceScaleId: "adx",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "+DI",
        });
        plusLine.setData(plusPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        const minusLine = chart.addLineSeries({
          color: TV.minusDi,
          lineWidth: 1,
          priceScaleId: "adx",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "−DI",
        });
        minusLine.setData(minusPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        adxLine.createPriceLine({
          price: 25,
          color: "rgba(255,202,40,0.45)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
        });
        chips.push({
          key: "adx",
          label: `ADX ${adxPts[adxPts.length - 1]!.value}`,
          color: TV.adx,
        });
      }
    }

    if (showStoch) {
      const st = computeStochasticSeries(indCandles, 14, 3);
      const kPts = clipVisible(st.k);
      const dPts = clipVisible(st.d);
      if (kPts.length) {
        chart.priceScale("stoch").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        const kLine = chart.addLineSeries({
          color: TV.stochK,
          lineWidth: 1,
          priceScaleId: "stoch",
          priceLineVisible: false,
          lastValueVisible: true,
          title: "%K",
        });
        kLine.setData(kPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        const dLine = chart.addLineSeries({
          color: TV.stochD,
          lineWidth: 1,
          priceScaleId: "stoch",
          priceLineVisible: false,
          lastValueVisible: false,
          title: "%D",
        });
        dLine.setData(dPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        kLine.createPriceLine({ price: 80, color: "rgba(239,83,80,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        kLine.createPriceLine({ price: 20, color: "rgba(38,166,154,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        chips.push({
          key: "stochastic",
          label: `Stoch ${kPts[kPts.length - 1]!.value}`,
          color: TV.stochK,
        });
      }
    }

    if (showWilliams) {
      const wrPts = clipVisible(computeWilliamsRSeries(indCandles, 14));
      if (wrPts.length) {
        const wr = chart.addLineSeries({
          color: TV.williams,
          lineWidth: 1,
          priceScaleId: "williams",
          priceLineVisible: false,
          lastValueVisible: true,
          title: "%R",
        });
        chart.priceScale("williams").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        wr.setData(wrPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        wr.createPriceLine({ price: -20, color: "rgba(239,83,80,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        wr.createPriceLine({ price: -80, color: "rgba(38,166,154,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        chips.push({
          key: "williamsR",
          label: `%R ${wrPts[wrPts.length - 1]!.value}`,
          color: TV.williams,
        });
      }
    }

    if (showCci) {
      const cciPts = clipVisible(computeCciSeries(indCandles, 20));
      if (cciPts.length) {
        const cci = chart.addLineSeries({
          color: TV.cci,
          lineWidth: 1,
          priceScaleId: "cci",
          priceLineVisible: false,
          lastValueVisible: true,
          title: "CCI",
        });
        chart.priceScale("cci").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        cci.setData(cciPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        cci.createPriceLine({ price: 100, color: "rgba(239,83,80,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        cci.createPriceLine({ price: -100, color: "rgba(38,166,154,0.45)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        chips.push({
          key: "cci",
          label: `CCI ${cciPts[cciPts.length - 1]!.value}`,
          color: TV.cci,
        });
      }
    }

    if (showObv) {
      const flowPts = clipVisible(
        indicators.volumeFlow ? computeVolumeFlow(indCandles) : computeObv(indCandles)
      );
      if (flowPts.length > 1) {
        const flow = chart.addLineSeries({
          color: TV.obv,
          lineWidth: 1,
          priceScaleId: "flow",
          priceLineVisible: false,
          lastValueVisible: true,
          title: indicators.volumeFlow ? "Vol/SMA20" : "OBV",
        });
        chart.priceScale("flow").applyOptions({
          scaleMargins: nextPaneMargins(),
        });
        flow.setData(flowPts.map((p) => ({ time: p.time as Time, value: p.value })) as LineData[]);
        chips.push({
          key: indicators.volumeFlow ? "volumeFlow" : "obv",
          label: indicators.volumeFlow ? "Flux volume" : "OBV",
          color: TV.obv,
        });
      }
    }

    setOverlayChips(chips);
    if (visibleRangeRef.current) {
      chart.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
    } else {
      chart.timeScale().fitContent();
    }
    applyAutoscaleWithDrawings();

    const onVisibleRange = (range: { from: number; to: number } | null) => {
      if (range) visibleRangeRef.current = { from: range.from, to: range.to };
      syncOverlays();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRange);

    const handler = (param: MouseEventParams) => {
      if (!onCrosshair) return;
      if (!param.time || !param.seriesData) {
        onCrosshair(null);
        return;
      }
      const raw = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (!raw || raw.open === undefined) {
        onCrosshair(null);
        return;
      }
      const i = candles.findIndex((c) => c.time === String(param.time));
      const prev = i > 0 ? candles[i - 1]!.close : raw.open;
      const chg = prev > 0 ? ((raw.close - prev) / prev) * 100 : 0;
      const vol = i >= 0 ? candles[i]!.volume : null;
      const volTxt = vol && vol > 0 ? ` Vol ${vol.toLocaleString("fr-FR")}` : " Vol N/D";
      onCrosshair(
        `O ${fmt(raw.open)} H ${fmt(raw.high)} L ${fmt(raw.low)} C ${fmt(raw.close)} ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%${volTxt}`
      );
    };
    chart.subscribeCrosshairMove(handler);

    const clickHandler = (param: MouseEventParams) => {
      const tool = drawToolRef.current;
      if (tool === "zoom" || tool === "cross" || tool === "undo" || tool === "trash") return;
      if (handleDragRef.current) return;
      if (!param.point || param.time === undefined || !candleRef.current) return;
      const price = candleRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;

      if (tool === "horiz") {
        commitDrawing({ id: newDrawingId(), type: "horiz", price });
        return;
      }

      if (tool === "trend" || tool === "fib" || tool === "measure") {
        const point = { time: param.time as Time, price };
        if (!twoPointStartRef.current) {
          twoPointStartRef.current = point;
          return;
        }
        const start = twoPointStartRef.current;
        twoPointStartRef.current = null;
        const base = {
          id: newDrawingId(),
          t1: String(start.time),
          p1: start.price,
          t2: String(point.time),
          p2: point.price,
        };
        if (tool === "trend") {
          commitDrawing({ ...base, type: "trend" });
        } else if (tool === "fib") {
          commitDrawing({ ...base, type: "fib" });
        } else {
          commitDrawing({ ...base, type: "measure" });
        }
      }
    };
    chart.subscribeClick(clickHandler);

    // Premier positionnement des poignées
    requestAnimationFrame(() => syncOverlays());

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
      syncOverlays();
    });
    ro.observe(el);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRange);
      chart.unsubscribeCrosshairMove(handler);
      chart.unsubscribeClick(clickHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      setOverlayHandles([]);
      setMeasureBadges([]);
    };
  }, [
    ticker,
    series,
    fullSeries,
    interval,
    compareSeries,
    indicators,
    showVolume,
    percentScale,
    logScale,
    height,
    onCrosshair,
    onIntervalNote,
  ]);

  if (series.length === 0) {
    return <div className={styles.empty}>Historique insuffisant pour afficher le graphique (N/D).</div>;
  }

  const zoomMode = drawTool === "zoom";
  const showDrawingHandles = !zoomMode;

  function moveDrawingEndpoint(
    drawingId: string,
    endpoint: OverlayHandle["endpoint"],
    clientX: number,
    clientY: number,
    stageEl: HTMLElement
  ) {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle) return;
    const rect = stageEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const price = candle.coordinateToPrice(y);
    if (price == null) return;
    const time = chart.timeScale().coordinateToTime(x);

    const next = drawingsDataRef.current.map((d) => {
      if (d.id !== drawingId) return d;
      if (d.type === "horiz" && endpoint === "price") {
        return { ...d, price };
      }
      if (d.type === "fib" && !("p1" in d)) {
        if (endpoint === "high") return { ...d, high: Math.max(price, d.low) };
        if (endpoint === "low") return { ...d, low: Math.min(price, d.high) };
        return d;
      }
      if (d.type === "trend" || d.type === "measure" || (d.type === "fib" && "p1" in d)) {
        if (time == null) return d;
        if (endpoint === "a") return { ...d, t1: String(time), p1: price };
        if (endpoint === "b") return { ...d, t2: String(time), p2: price };
      }
      return d;
    });
    persistDrawings(next);
    reapplyDrawingsRef.current();
  }

  function beginHandleDrag(
    e: ReactPointerEvent<HTMLButtonElement>,
    handle: OverlayHandle
  ) {
    if (e.button !== 0 || zoomMode) return;
    e.preventDefault();
    e.stopPropagation();
    recordDrawingsUndo();
    handleDragRef.current = {
      drawingId: handle.drawingId,
      endpoint: handle.endpoint,
      moved: false,
    };
    const chart = chartRef.current;
    chart?.applyOptions({
      handleScroll: { pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current;
    if (!drag) return;
    drag.moved = true;
    const stage = e.currentTarget.closest(`.${styles.chartStage}`) as HTMLElement | null;
    if (!stage) return;
    moveDrawingEndpoint(drag.drawingId, drag.endpoint, e.clientX, e.clientY, stage);
  }

  function endHandleDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!handleDragRef.current) return;
    handleDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const chart = chartRef.current;
    const zooming = drawToolRef.current === "zoom";
    chart?.applyOptions({
      handleScroll: {
        pressedMouseMove: !zooming,
        horzTouchDrag: !zooming,
        vertTouchDrag: !zooming,
      },
      handleScale: { axisPressedMouseMove: !zooming },
    });
    syncOverlaysRef.current();
  }

  return (
    <div className={styles.wrap}>
      {overlayChips.length > 0 && (
        <div className={styles.overlayStack} aria-label="Indicateurs superposés">
          {overlayChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={styles.overlayChip}
              style={{ color: chip.color, borderColor: `${chip.color}66` }}
              title="Clic ou clic droit pour retirer cet indicateur"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveIndicator?.(chip.key);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveIndicator?.(chip.key);
              }}
            >
              <span>{chip.label}</span>
              <span className={styles.overlayChipRemove} aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      {zoomMode && (
        <div className={styles.zoomHint}>Glisser pour zoomer · Double-clic pour tout afficher</div>
      )}
      <div className={styles.chartStage} style={{ height }}>
        <div ref={containerRef} className={styles.canvas} style={{ height }} />
        {showDrawingHandles &&
          measureBadges.map((b) => (
            <div
              key={`badge-${b.id}`}
              className={b.up ? styles.measureBadgeUp : styles.measureBadgeDown}
              style={{ left: b.left, top: b.top }}
            >
              {b.text}
            </div>
          ))}
        {showDrawingHandles &&
          overlayHandles.map((h) => (
            <button
              key={`${h.drawingId}-${h.endpoint}`}
              type="button"
              className={styles.drawHandle}
              style={{ left: h.left, top: h.top }}
              title="Glisser pour déplacer"
              aria-label="Déplacer l'extrémité du tracé"
              onPointerDown={(e) => beginHandleDrag(e, h)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={endHandleDrag}
              onPointerCancel={endHandleDrag}
            />
          ))}
        {zoomMode && (
          <div
            className={styles.zoomCapture}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              dragStartRef.current = { x, y };
              setMarquee({ x0: x, y0: y, x1: x, y1: y });
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragStartRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              setMarquee({
                x0: dragStartRef.current.x,
                y0: dragStartRef.current.y,
                x1: x,
                y1: y,
              });
            }}
            onPointerUp={(e) => {
              if (!dragStartRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const start = dragStartRef.current;
              dragStartRef.current = null;
              setMarquee(null);
              applyMarqueeZoom(start.x, start.y, x, y);
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* already released */
              }
            }}
            onPointerCancel={() => {
              dragStartRef.current = null;
              setMarquee(null);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              dragStartRef.current = null;
              setMarquee(null);
              resetZoomView();
            }}
          >
            {marquee && (
              <div
                className={styles.marquee}
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}
