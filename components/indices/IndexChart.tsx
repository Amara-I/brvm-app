"use client";

// Courbe d'un indice (périodes 1M → MAX) avec, sur 1M–1A, les niveaux techniques
// tracés sur la courbe : zones de support / résistance, objectif et invalidation du
// scénario le plus probable, niveau actuel. Comme les graphes des actions : repères
// discrets sur le tracé (S, R, O1, I, N), lecture à gauche et légende des niveaux à
// droite sous le graphe.

import { memo, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import LockedTeaser from "@/components/entitlements/LockedTeaser";
import { isLockedChartRange } from "@/lib/entitlements/chart-cap";
import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import type { ChartRange } from "@/lib/charts/indicators";
import type { FormatApi } from "@/lib/i18n/format";
import LevelLegend, { type LevelLegendItem } from "@/components/charts/LevelLegend";
import { formatDistancePct, formatPrice, formatPriceRange, stackLabelBoxes } from "@/lib/technical-analysis/level-label";
import type { TechnicalAnalysis } from "@/lib/technical-analysis/types";
import type { IndexSeriesPoint } from "@/lib/markets/index-sheet";
import { C } from "@/lib/theme/colors";
import styles from "./Indices.module.css";

const CHART_H = 320;
const MARGIN_TOP = 12;
const X_AXIS_H = 30;
const PLOT_H = CHART_H - MARGIN_TOP - X_AXIS_H;

const RANGES: ChartRange[] = ["1M", "3M", "6M", "1A", "5A", "MAX"];
const LEVEL_RANGES = new Set<ChartRange>(["1M", "3M", "6M", "1A"]);

type LevelKind = "support" | "resistance" | "target" | "stop" | "last";

export interface IndexChartLevel {
  kind: LevelKind;
  price: number;
  /** Zone : borne haute (le libellé porte la fourchette). */
  priceHigh?: number;
  name: string;
  /** Repère court affiché sur le tracé (S, R, O1, I, N). */
  short: string;
}

type LevelNames = {
  support: string;
  resistance: string;
  target: string;
  stop: string;
  last: string;
  supportShort: string;
  resistanceShort: string;
  /** Avec `{n}` : O{n} → O1. */
  targetShort: string;
  stopShort: string;
  lastShort: string;
};

/**
 * Niveaux à tracer : la zone de support et la zone de résistance les plus proches, le niveau
 * actuel, puis l'objectif et l'invalidation du scénario directionnel le plus probable
 * (un seuil déjà couvert par une zone tracée n'est pas répété). Triés du plus haut au plus bas.
 */
export function chartLevels(
  analysis: TechnicalAnalysis | null,
  names: LevelNames
): IndexChartLevel[] {
  if (!analysis || analysis.structure.lastClose == null) return [];
  const last = analysis.structure.lastClose;
  const out: IndexChartLevel[] = [{ kind: "last", price: last, name: names.last, short: names.lastShort }];
  const nearest = (kind: "support" | "resistance") =>
    analysis.zones
      .filter((z) => z.kind === kind && (kind === "support" ? z.mid < last : z.mid > last))
      .sort((a, b) => Math.abs(a.mid - last) - Math.abs(b.mid - last))[0];
  const zones = [nearest("support"), nearest("resistance")].filter((z): z is NonNullable<typeof z> => z != null);
  for (const z of zones) {
    const support = z.kind === "support";
    out.push({
      kind: support ? "support" : "resistance",
      price: z.low,
      priceHigh: z.high,
      name: support ? names.support : names.resistance,
      short: support ? names.supportShort : names.resistanceShort,
    });
  }
  const covered = (price: number) => zones.some((z) => price >= z.low - last * 0.002 && price <= z.high + last * 0.002);
  const top = [...analysis.scenarios]
    .filter((sc) => sc.bias !== "neutral")
    .sort((a, b) => b.probability - a.probability)[0];
  if (top) {
    const targetIndex = top.targets.findIndex((target) => !covered(target));
    if (targetIndex >= 0) {
      out.push({
        kind: "target",
        price: top.targets[targetIndex]!,
        name: `${names.target} ${targetIndex + 1}`,
        short: names.targetShort.replace("{n}", String(targetIndex + 1)),
      });
    }
    if (top.invalidation != null && !covered(top.invalidation)) {
      out.push({ kind: "stop", price: top.invalidation, name: names.stop, short: names.stopShort });
    }
  }
  // Un niveau à plus de 25 % du niveau actuel n'aide pas la lecture : on le retire.
  return out
    .filter((l) => Math.abs(l.price - last) / last <= 0.25)
    .sort((a, b) => (b.priceHigh ?? b.price) - (a.priceHigh ?? a.price));
}

function dateLabel(iso: string, format: FormatApi, withDay = true): string {
  return format.date(new Date(`${iso.slice(0, 10)}T12:00:00.000Z`), {
    ...(withDay ? { day: "numeric" as const } : {}),
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Même code couleur que les scénarios et le graphe des actions (#120) : au-dessus du niveau
 *  en vert (résistance, objectif), en dessous en rouge (support, invalidation). */
function levelColor(kind: LevelKind): string {
  if (kind === "resistance" || kind === "target") return "#26a69a";
  if (kind === "support" || kind === "stop") return "#ef5350";
  return "#d1d4dc";
}

const TAG_H = 16;

function IndexChart({
  series,
  analysis,
  aside,
  gatedVisitor = false,
}: {
  series: IndexSeriesPoint[];
  analysis: TechnicalAnalysis | null;
  /** Lecture affichée à gauche sous le graphe (la légende des niveaux est à droite). */
  aside?: ReactNode;
  gatedVisitor?: boolean;
}) {
  const { t, format, locale } = useI18n();
  const lang = locale === "en" ? "en" : "fr";
  const [range, setRange] = useState<ChartRange>("1A");
  const [showLevels, setShowLevels] = useState(true);

  const windowed = useMemo(
    () => applyChartSeriesWindow(series, { range, defaultTo1A: false }).series as IndexSeriesPoint[],
    [series, range]
  );
  const shortRange = range === "1M" || range === "3M" || range === "6M";
  const levelsAllowed = !gatedVisitor && LEVEL_RANGES.has(range);
  const levels = useMemo(
    () =>
      levelsAllowed && showLevels
        ? chartLevels(analysis, {
            support: t("market.indices.sheet.legendSupport"),
            resistance: t("market.indices.sheet.legendResistance"),
            target: t("market.indices.sheet.legendTarget"),
            stop: t("market.indices.sheet.legendInvalidation"),
            last: t("market.indices.sheet.legendLast"),
            supportShort: t("company.ta.chart.supportShort"),
            resistanceShort: t("company.ta.chart.resistanceShort"),
            targetShort: t("company.ta.chart.targetShort", { n: "{n}" }),
            stopShort: t("company.ta.chart.invalidationShort"),
            lastShort: t("market.indices.ta.chart.lastShort"),
          })
        : [],
    [analysis, levelsAllowed, showLevels, t]
  );

  const domain = useMemo<[number, number] | null>(() => {
    if (windowed.length === 0) return null;
    let lo = Math.min(...windowed.map((p) => p.value));
    let hi = Math.max(...windowed.map((p) => p.value));
    for (const l of levels) {
      lo = Math.min(lo, l.price);
      hi = Math.max(hi, l.priceHigh ?? l.price);
    }
    const pad = Math.max((hi - lo) * 0.06, hi * 0.002);
    return [Math.max(0, lo - pad), hi + pad];
  }, [windowed, levels]);

  const rangeChange = useMemo(() => {
    const first = windowed[0];
    const last = windowed[windowed.length - 1];
    if (!first || !last || first === last || !(first.value > 0)) return null;
    return ((last.value - first.value) / first.value) * 100;
  }, [windowed]);

  const desiredYs = useMemo(() => {
    if (!domain) return [];
    const [lo, hi] = domain;
    return levels.map((l) => {
      const mid = l.priceHigh != null ? (l.price + l.priceHigh) / 2 : l.price;
      return MARGIN_TOP + ((hi - mid) / (hi - lo)) * PLOT_H;
    });
  }, [levels, domain]);

  // Repères de hauteur fixe : écartés sans mesure du DOM.
  const tops = useMemo(
    () => stackLabelBoxes(desiredYs, desiredYs.map(() => TAG_H), MARGIN_TOP, MARGIN_TOP + PLOT_H, 2),
    [desiredYs]
  );

  const pts = (v: number) => formatPrice(v, "PTS", lang);
  const signed = (v: number) => format.percent(v, 2, true);
  const indexByTime = useMemo(() => {
    const m = new Map<string, number>();
    windowed.forEach((p, i) => m.set(p.time, i));
    return m;
  }, [windowed]);
  const last = analysis?.structure.lastClose ?? windowed[windowed.length - 1]?.value ?? null;
  const legendItems: LevelLegendItem[] = levels.map((l, i) => ({
    key: `${l.kind}-${i}`,
    short: l.short,
    color: levelColor(l.kind),
    name: l.name,
    value: l.priceHigh != null ? formatPriceRange(l.price, l.priceHigh, "PTS", lang) : pts(l.price),
    distance:
      l.kind !== "last" && last != null
        ? formatDistancePct(last, l.priceHigh != null ? (l.price + l.priceHigh) / 2 : l.price)
        : null,
    distanceTone: l.kind === "stop" || l.kind === "support" ? ("bad" as const) : ("good" as const),
  }));
  const up = (rangeChange ?? 0) >= 0;
  const stroke = up ? C.green : C.red;

  return (
    <section className={styles.card} aria-labelledby="index-chart-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="index-chart-title" className={styles.cardTitle}>
            {t("market.indices.sheet.chartTitle")}
          </h2>
          <p className={styles.rangeChange}>
            {t("market.indices.sheet.rangeChange")}{" "}
            <strong className={rangeChange == null ? undefined : up ? styles.pos : styles.neg}>
              {rangeChange == null ? t("common.nd") : signed(rangeChange)}
            </strong>
          </p>
        </div>
        <div className={styles.rangeRow} role="group" aria-label={t("market.indices.period")}>
          {RANGES.map((key) => (
            gatedVisitor && isLockedChartRange(key) ? (
              <LockedTeaser key={key} compact label={key === "1A" ? t("market.indices.range1A") : key === "5A" ? t("market.indices.range5A") : key === "MAX" ? "MAX" : key} />
            ) : (
            <button
              key={key}
              type="button"
              className={range === key ? styles.rangeActive : styles.rangeBtn}
              aria-pressed={range === key}
              onClick={() => setRange(key)}
            >
              {key === "1A" ? t("market.indices.range1A") : key === "5A" ? t("market.indices.range5A") : key === "MAX" ? "MAX" : key}
            </button>
            )
          ))}
        </div>
      </div>
      <div className={styles.levelToggleRow}>
        {levelsAllowed ? (
          <label className={styles.levelToggle}>
            <input type="checkbox" checked={showLevels} onChange={(e) => setShowLevels(e.target.checked)} />
            <span>{t("market.indices.sheet.levels")}</span>
          </label>
        ) : (
          <span className={styles.levelHint}>{t("market.indices.sheet.levelsLongRange")}</span>
        )}
        {levelsAllowed && showLevels && levels.length > 0 ? (
          <span className={`${styles.levelHint} ${styles.hideMobile}`}>{t("market.indices.sheet.levelsHint")}</span>
        ) : null}
      </div>
      {windowed.length > 1 && domain ? (
        <div className={`${styles.chartWrap} ${levels.length > 0 ? styles.chartWrapGutter : ""}`}>
          <div className={styles.chartPlot}>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <AreaChart data={windowed} margin={{ top: MARGIN_TOP, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="indexArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  stroke={C.textDim}
                  fontSize={11}
                  height={X_AXIS_H}
                  minTickGap={shortRange ? 24 : 40}
                  tickFormatter={(time: string) => (shortRange ? dateLabel(time, format) : time.slice(0, 7))}
                />
                <YAxis
                  stroke={C.textDim}
                  fontSize={11}
                  width={domain[1] >= 100000 ? 56 : 62}
                  domain={domain}
                  allowDataOverflow
                  tickFormatter={(v: number) =>
                    v >= 100000 ? `${format.number(Math.round(v / 1000))} k` : format.number(Math.round(v))
                  }
                />
                {levels
                  .filter((l) => l.priceHigh != null)
                  .map((l, i) => (
                    <ReferenceArea
                      key={`z-${l.kind}-${i}`}
                      y1={l.price}
                      y2={l.priceHigh}
                      fill={levelColor(l.kind)}
                      fillOpacity={0.12}
                      stroke={levelColor(l.kind)}
                      strokeOpacity={0.45}
                      strokeDasharray="4 3"
                      ifOverflow="hidden"
                    />
                  ))}
                {levels
                  .filter((l) => l.priceHigh == null)
                  .map((l, i) => (
                    <ReferenceLine
                      key={`l-${l.kind}-${i}`}
                      y={l.price}
                      stroke={levelColor(l.kind)}
                      strokeDasharray={l.kind === "last" ? undefined : "5 4"}
                      strokeOpacity={0.9}
                      ifOverflow="hidden"
                    />
                  ))}
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: C.textDim, strokeDasharray: "3 3", strokeOpacity: 0.7 }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as IndexSeriesPoint | undefined;
                    if (!active || !point) return null;
                    const i = indexByTime.get(point.time) ?? -1;
                    const prev = i > 0 ? windowed[i - 1]!.value : null;
                    const v = prev != null && prev > 0 ? ((point.value - prev) / prev) * 100 : null;
                    return (
                      <div className={styles.chartTip}>
                        <div className={styles.chartTipDate}>{dateLabel(point.time, format)}</div>
                        <div className={styles.chartTipValue}>{pts(point.value)}</div>
                        {v != null ? <div className={v >= 0 ? styles.pos : styles.neg}>{signed(v)}</div> : null}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={t("market.indices.level")}
                  isAnimationActive={false}
                  stroke={stroke}
                  fill="url(#indexArea)"
                  strokeWidth={2}
                  activeDot={{ r: 4, stroke: C.panel, strokeWidth: 2, fill: stroke }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {levels.length > 0 ? (
            <div className={styles.levelTags} aria-hidden="true">
              {levels.map((l, i) => (
                <span
                  key={`${l.kind}-${i}`}
                  className={styles.levelTag}
                  style={{ top: `${tops[i] ?? desiredYs[i] ?? 0}px`, background: levelColor(l.kind) }}
                >
                  {l.short}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className={styles.empty}>{t("market.indices.historyEmpty")}</p>
      )}
      {aside || legendItems.length > 0 ? (
        <div className={`${styles.chartBelow} ${legendItems.length > 0 && aside ? styles.chartBelowSplit : ""}`}>
          {aside ? <div className={styles.chartBelowMain}>{aside}</div> : null}
          {legendItems.length > 0 ? (
            <LevelLegend title={t("charts.levelsLegend")} items={legendItems} className={styles.chartBelowLevels} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default memo(IndexChart);
