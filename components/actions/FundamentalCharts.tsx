"use client";

// Graphiques de l'onglet Analyse fondamentale. Chargé seulement quand une
// section est ouverte. Les chiffres restent dans les tableaux : le graphique
// est un complément, masqué aux lecteurs d'écran.

import { useMemo, type ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PerformanceYear } from "@/lib/fundamental/brvm-analysis";
import type { PricePoint } from "@/lib/ngx/price-stats";
import { C } from "@/lib/theme/colors";
import styles from "./FundamentalAnalysis.module.css";

const tipStyle = {
  background: "var(--c-panel)",
  border: "1px solid var(--c-border)",
  borderRadius: 8,
  color: "var(--c-text)",
  fontSize: 12,
  padding: "6px 8px",
};

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ChartFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.chart} role="img" aria-label={label}>
      {children}
    </div>
  );
}

function PerformanceChart({ years }: { years: PerformanceYear[] }) {
  const { t, format } = useI18n();
  const data = years.filter((y) => y.revenue != null || y.netIncome != null);
  const hasMargin = data.some((y) => y.netMargin != null);
  if (data.length === 0) return null;
  return (
    <ChartFrame label={t("company.fundamental.chartPerformance")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
          <YAxis stroke={C.textDim} fontSize={11} width={36} />
          {hasMargin ? <YAxis yAxisId="margin" orientation="right" stroke={C.textDim} fontSize={11} width={32} unit="%" /> : null}
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value);
              const label = String(name);
              if (label === t("company.fundamental.chartMargin")) return [format.percent(n, 1), label];
              return [`${format.decimal(n, 1)} ${t("company.fundamental.field.bnUnit")}`, label];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name={t("company.fundamental.chartRevenue")} fill={C.gold} isAnimationActive={false} />
          <Bar dataKey="netIncome" name={t("company.fundamental.chartNet")} fill={C.green} isAnimationActive={false} />
          {hasMargin ? (
            <Line
              yAxisId="margin"
              type="monotone"
              dataKey="netMargin"
              name={t("company.fundamental.chartMargin")}
              stroke={C.blue}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function PriceChart({
  points,
  high52,
  low52,
}: {
  points: readonly PricePoint[];
  high52: number | null;
  low52: number | null;
}) {
  const { t, format } = useI18n();
  const data = useMemo(() => {
    const sorted = points
      .filter((p) => p.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.time))
      .sort((a, b) => (a.time < b.time ? -1 : 1));
    if (sorted.length === 0) return [];
    const last = sorted[sorted.length - 1]!.time;
    const from = shiftDays(last, -370);
    const window = sorted.filter((p) => p.time >= from);
    const series = window.length >= 2 ? window : sorted.slice(-60);
    return series.map((p) => ({
      time: p.time,
      close: p.value,
      volume: typeof p.volume === "number" && p.volume > 0 ? p.volume : null,
    }));
  }, [points]);
  const hasVolume = data.some((p) => p.volume != null);
  if (data.length < 2) return null;
  return (
    <ChartFrame label={t("company.fundamental.chartPrice")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
          <XAxis dataKey="time" stroke={C.textDim} fontSize={11} minTickGap={28} tickFormatter={(value: string) => value.slice(5)} />
          <YAxis stroke={C.textDim} fontSize={11} width={48} domain={["auto", "auto"]} />
          {hasVolume ? <YAxis yAxisId="vol" orientation="right" stroke={C.textDim} fontSize={11} width={32} /> : null}
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value);
              const label = String(name);
              return label === t("company.fundamental.chartVolume") ? [format.integer(n), label] : [format.fcfa(n), label];
            }}
          />
          <Area
            type="monotone"
            dataKey="close"
            name={t("company.fundamental.chartClose")}
            stroke={C.gold}
            fill={C.gold}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {hasVolume ? (
            <Bar yAxisId="vol" dataKey="volume" name={t("company.fundamental.chartVolume")} fill={C.silver} isAnimationActive={false} />
          ) : null}
          {high52 != null ? (
            <ReferenceLine y={high52} stroke={C.green} strokeDasharray="4 4" ifOverflow="extendDomain" />
          ) : null}
          {low52 != null ? (
            <ReferenceLine y={low52} stroke={C.red} strokeDasharray="4 4" ifOverflow="extendDomain" />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ValuationChart({
  price,
  low,
  high,
  single,
  methods,
}: {
  price: number | null;
  low: number | null;
  high: number | null;
  single: boolean;
  methods: { label: string; value: number }[];
}) {
  const { t, format } = useI18n();
  if (price == null || (methods.length === 0 && low == null)) return null;
  const marks = [price, low, high, ...methods.map((m) => m.value)].filter((v): v is number => v != null && v > 0);
  if (marks.length === 0) return null;
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  const pad = Math.max((max - min) * 0.08, max * 0.04, 1);
  const start = min - pad;
  const span = max + pad - start;
  const left = (value: number) => `${Math.min(100, Math.max(0, ((value - start) / span) * 100))}%`;
  return (
    <div className={styles.rangeBlock}>
      <div className={styles.range} role="img" aria-label={t("company.fundamental.chartValuation")}>
        <div className={styles.rangeTrack} />
        {!single && low != null && high != null && high > low ? (
          <div className={styles.rangeBand} style={{ left: left(low), width: `calc(${left(high)} - ${left(low)})` }} />
        ) : null}
        {single && low != null ? <div className={styles.rangeTick} style={{ left: left(low) }} /> : null}
        <div className={styles.rangeMark} style={{ left: left(price) }} />
      </div>
      <div className={styles.rangeCaption}>
        <span>{format.fcfa(min)}</span>
        <span>
          {t("company.fundamental.field.price")} {format.fcfa(price)}
        </span>
        <span>{format.fcfa(max)}</span>
      </div>
    </div>
  );
}

function SectorChart({ bars }: { bars: { label: string; index: number }[] }) {
  const { t, format } = useI18n();
  if (bars.length === 0) return null;
  return (
    <ChartFrame label={t("company.fundamental.chartSector")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={C.textDim} fontSize={11} interval={0} angle={-24} textAnchor="end" height={48} />
          <YAxis stroke={C.textDim} fontSize={11} width={36} />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value) => [format.decimal(typeof value === "number" ? value : Number(value), 0), t("company.fundamental.chartIndex")]}
          />
          <ReferenceLine y={100} stroke={C.gold} strokeDasharray="4 4" label={{ value: "100", fill: C.textDim, fontSize: 11 }} />
          <Bar dataKey="index" name={t("company.fundamental.chartIndex")} fill={C.teal} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function DividendChart({ points }: { points: { year: string; dps: number; yieldPercent: number | null }[] }) {
  const { t, format } = useI18n();
  if (points.length === 0) return null;
  const hasYield = points.some((p) => p.yieldPercent != null);
  return (
    <ChartFrame label={t("company.fundamental.chartDividends")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
          <YAxis stroke={C.textDim} fontSize={11} width={40} />
          {hasYield ? <YAxis yAxisId="yield" orientation="right" stroke={C.textDim} fontSize={11} width={32} unit="%" /> : null}
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value);
              const label = String(name);
              return label === t("company.fundamental.chartYield") ? [format.percent(n, 2), label] : [format.fcfa(n), label];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="dps" name={t("company.fundamental.chartDps")} fill={C.gold} isAnimationActive={false} />
          {hasYield ? (
            <Line
              yAxisId="yield"
              type="monotone"
              dataKey="yieldPercent"
              name={t("company.fundamental.chartYield")}
              stroke={C.green}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ConclusionChart({ bars }: { bars: { label: string; share: number }[] }) {
  const { t, format } = useI18n();
  if (bars.length === 0) return null;
  return (
    <ChartFrame label={t("company.fundamental.chartConclusion")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={bars} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke={C.textDim} fontSize={11} unit="%" />
          <YAxis type="category" dataKey="label" stroke={C.textDim} fontSize={11} width={88} />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value) => [format.percent(typeof value === "number" ? value : Number(value), 0), t("company.fundamental.chartShare")]}
          />
          <Bar dataKey="share" name={t("company.fundamental.chartShare")} fill={C.gold} isAnimationActive={false} barSize={14} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export type FundamentalChartProps =
  | { kind: "performance"; years: PerformanceYear[] }
  | { kind: "price"; points: readonly PricePoint[]; high52: number | null; low52: number | null }
  | {
      kind: "valuation";
      price: number | null;
      low: number | null;
      high: number | null;
      single: boolean;
      methods: { label: string; value: number }[];
    }
  | { kind: "sector"; bars: { label: string; index: number }[] }
  | { kind: "dividends"; points: { year: string; dps: number; yieldPercent: number | null }[] }
  | { kind: "conclusion"; bars: { label: string; share: number }[] };

export default function FundamentalCharts(props: FundamentalChartProps) {
  switch (props.kind) {
    case "performance":
      return <PerformanceChart years={props.years} />;
    case "price":
      return <PriceChart points={props.points} high52={props.high52} low52={props.low52} />;
    case "valuation":
      return (
        <ValuationChart price={props.price} low={props.low} high={props.high} single={props.single} methods={props.methods} />
      );
    case "sector":
      return <SectorChart bars={props.bars} />;
    case "dividends":
      return <DividendChart points={props.points} />;
    case "conclusion":
      return <ConclusionChart bars={props.bars} />;
  }
}
