"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { FormatApi } from "@/lib/i18n/format";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { C } from "@/lib/theme/colors";
import styles from "./CompanySheet.module.css";

export interface OverviewSplitGuide {
  key: string;
  x: string;
}

interface DefaultOhlc {
  o: string;
  h: string;
  l: string;
  c: string;
  vol: string;
  var: string;
}

interface Props {
  /** Série affichée (LTTB, ≤ 360 points). */
  chartSeries: ChartClosePoint[];
  /** Série complète de la période : sert à retrouver la séance précédente réelle. */
  rangedSeries: ChartClosePoint[];
  shortChart: boolean;
  yDomain: [number, number] | ["auto", "auto"];
  splitGuides: OverviewSplitGuide[];
  /** Bandeau OHLC de la dernière séance (affiché hors survol). */
  defaultOhlc: DefaultOhlc;
  defaultUp: boolean;
  nd: string;
  emptyLabel: string;
}

interface HoverInfo {
  time: string;
  close: number;
  open: number;
  volume: number | null;
  variation: number | null;
}

function dateLabel(iso: string, format: FormatApi, withWeekday = false): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  return format.date(new Date(`${iso.slice(0, 10)}T12:00:00.000Z`), {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Graphique de la vue d'ensemble : le prix, la variation et la date suivent le curseur
 * (infobulle + bandeau OHLC), puis reviennent à la dernière séance quand il quitte le graphe.
 * L'état de survol vit ici pour ne pas re-rendre toute la fiche à chaque mouvement de souris.
 */
function OverviewPriceChart({
  chartSeries,
  rangedSeries,
  shortChart,
  yDomain,
  splitGuides,
  defaultOhlc,
  defaultUp,
  nd,
  emptyLabel,
}: Props) {
  const { t, format } = useI18n();
  const [hoverTime, setHoverTime] = useState<string | null>(null);

  const data = chartSeries;
  const tickLabel = useCallback(
    (time: string) => (shortChart ? dateLabel(time, format) : time.slice(0, 7)),
    [shortChart, format]
  );
  const indexByTime = useMemo(() => {
    const m = new Map<string, number>();
    rangedSeries.forEach((p, i) => m.set(p.time, i));
    return m;
  }, [rangedSeries]);

  const infoFor = useCallback(
    (time: string, close: number, volume: number | null | undefined): HoverInfo => {
      const i = indexByTime.get(time);
      const prev = i != null && i > 0 ? rangedSeries[i - 1]! : null;
      const open = prev ? prev.value : close;
      return {
        time,
        close,
        open,
        volume: volume ?? null,
        variation: prev && prev.value > 0 ? ((close - prev.value) / prev.value) * 100 : null,
      };
    },
    [indexByTime, rangedSeries]
  );

  const hover = useMemo<HoverInfo | null>(() => {
    if (!hoverTime) return null;
    const p = chartSeries.find((x) => x.time === hoverTime);
    return p ? infoFor(p.time, p.value, p.volume) : null;
  }, [hoverTime, chartSeries, infoFor]);

  const onMove = useCallback((state: { activePayload?: Array<{ payload?: { time?: string } }> } | null) => {
    const time = state?.activePayload?.[0]?.payload?.time ?? null;
    setHoverTime((cur) => (cur === time ? cur : time));
  }, []);
  const onLeave = useCallback(() => setHoverTime(null), []);

  const signed = (v: number) => `${v >= 0 ? "+" : "-"}${format.decimal(Math.abs(v), 2)}%`;
  const priceFmt = (v: number) => format.number(v);

  let strip = defaultOhlc;
  let stripUp = defaultUp;
  if (hover) {
    const high = Math.max(hover.open, hover.close);
    const low = Math.min(hover.open, hover.close);
    strip = {
      o: priceFmt(hover.open),
      h: priceFmt(high),
      l: priceFmt(low),
      c: priceFmt(hover.close),
      vol: hover.volume && hover.volume > 0 ? format.number(hover.volume) : nd,
      var: hover.variation != null ? signed(hover.variation) : nd,
    };
    stripUp = (hover.variation ?? 0) >= 0;
  }

  return (
    <>
      <div className={styles.ohlc} aria-live="off">
        {hover && <span className={styles.ohlcDate}>{dateLabel(hover.time, format, true)}</span>}
        <span>
          <em>{t("company.chart.o")}</em> {strip.o}
        </span>
        <span>
          <em>{t("company.chart.h")}</em> {strip.h}
        </span>
        <span>
          <em>{t("company.chart.l")}</em> {strip.l}
        </span>
        <span>
          <em>{t("company.chart.c")}</em> {strip.c}
        </span>
        <span className={stripUp ? styles.pos : styles.neg}>{strip.var}</span>
        <span>
          <em>{t("company.chart.vol")}</em> {strip.vol}
        </span>
      </div>
      <div className={styles.chartBox}>
        {data.length >= 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} onMouseMove={onMove as never} onMouseLeave={onLeave}>
              <defs>
                <linearGradient id="sheetGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
              {/* Axe sur la date complète (unique) : un axe « mois » aurait des catégories en double
                  et le curseur se fixerait sur le premier point de chaque mois. */}
              <XAxis
                dataKey="time"
                stroke={C.textDim}
                fontSize={11}
                minTickGap={shortChart ? 16 : 40}
                tickFormatter={tickLabel}
              />
              <YAxis stroke={C.textDim} fontSize={11} domain={yDomain} width={64} />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: C.textDim, strokeDasharray: "3 3", strokeOpacity: 0.7 }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as ChartClosePoint | undefined;
                  if (!active || !point) return null;
                  const info = infoFor(point.time, point.value, point.volume);
                  return (
                    <div className={styles.chartTip}>
                      <div className={styles.chartTipDate}>{dateLabel(info.time, format, true)}</div>
                      <div className={styles.chartTipPrice}>
                        {priceFmt(info.close)} <span>FCFA</span>
                      </div>
                      {info.variation != null && (
                        <div className={info.variation >= 0 ? styles.pos : styles.neg}>{signed(info.variation)}</div>
                      )}
                    </div>
                  );
                }}
              />
              {splitGuides.map((guide) => (
                <ReferenceLine
                  key={guide.key}
                  x={guide.x}
                  stroke={C.gold}
                  strokeDasharray="3 3"
                  strokeOpacity={0.7}
                />
              ))}
              <Area
                type="monotone"
                dataKey="value"
                name={t("company.chart.price")}
                stroke={C.green}
                fill="url(#sheetGreen)"
                strokeWidth={2}
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: C.panel, strokeWidth: 2, fill: C.green }}
                dot={shortChart ? { r: 4, strokeWidth: 0, fill: C.green } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className={styles.empty}>{emptyLabel}</p>
        )}
      </div>
    </>
  );
}

export default memo(OverviewPriceChart);
