"use client";

// Carte marché BRVM de la landing : capitalisation + graphe réel de l'indice
// BRVM Composite (niveaux officiels en base, segments droits, aucun lissage).
// Les libellés arrivent déjà traduits (cookie i18n lu côté serveur).

import { useId, useMemo, useRef, useState } from "react";
import { createFormat } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import {
  availableHeroRanges,
  buildHeroGeometry,
  downsampleHeroSeries,
  heroChangePercent,
  nearestHeroIndex,
  sliceHeroRange,
  type HeroPoint,
  type HeroRange,
} from "@/lib/landing/hero-chart";
import styles from "./Landing.module.css";

export interface MarketHeroCardLabels {
  /** « Capitalisation BRVM » */
  capLabel: string;
  /** « Clôture du JJ/MM/AAAA » déjà formaté ; vide si la date est inconnue. */
  closeOn: string;
  chartTitle: string;
  /** « Niveaux de clôture · lecture seule » (source du graphe) */
  chartSource: string;
  rangeAria: string;
  ranges: Record<HeroRange, string>;
  /** « sur {period} » — {period} = libellé de la période (5 ans…) */
  overPeriod: string;
  periodNames: Record<HeroRange, string>;
  start: string;
  end: string;
  high: string;
  low: string;
  noChart: string;
  stats: Array<{ value: string; label: string; title?: string }>;
}

export interface MarketHeroCardProps {
  locale: Locale;
  capitalisation: string;
  series: HeroPoint[];
  labels: MarketHeroCardLabels;
}

const VIEW_W = 560;
const VIEW_H = 220;
const MAX_DRAW_POINTS = 360;

export default function MarketHeroCard({ locale, capitalisation, series, labels }: MarketHeroCardProps) {
  const format = useMemo(() => createFormat(locale), [locale]);
  const ranges = useMemo(() => availableHeroRanges(series), [series]);
  const [range, setRange] = useState<HeroRange>(() => ranges[ranges.length - 1] ?? "MAX");
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const gradId = useId().replace(/:/g, "");

  const windowed = useMemo(() => sliceHeroRange(series, range), [series, range]);
  const drawn = useMemo(() => downsampleHeroSeries(windowed, MAX_DRAW_POINTS), [windowed]);
  const geo = useMemo(() => buildHeroGeometry(drawn, VIEW_W, VIEW_H, 14, 8), [drawn]);
  const change = heroChangePercent(windowed);

  const dateFmt = (iso: string) =>
    format.date(`${iso}T12:00:00Z`, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const lvl = (v: number) => format.decimal(v, 2);

  const first = windowed[0];
  const last = windowed[windowed.length - 1];
  const up = change != null && change >= 0;

  const onMove = (clientX: number) => {
    const el = plotRef.current;
    if (!el || !geo) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    setHover(nearestHeroIndex(geo.xPct, (clientX - rect.left) / rect.width));
  };

  const hovered = hover != null && geo ? drawn[Math.min(hover, drawn.length - 1)] : null;
  const hoverX = hover != null && geo ? geo.xPct[Math.min(hover, drawn.length - 1)]! : 0;
  const hoverY = hover != null && geo ? geo.yPct[Math.min(hover, drawn.length - 1)]! : 0;

  return (
    <div className={`${styles.card} ${styles.heroFigure} ${styles.hcCard}`}>
      <div className={styles.hcTop}>
        <div className={styles.hcTopCopy}>
          <div className={styles.cardLabel}>
            <span className={styles.liveDot} />
            {labels.capLabel}
          </div>
          <div className={styles.cardValue}>{capitalisation}</div>
        </div>
        {labels.closeOn ? <div className={styles.hcClose}>{labels.closeOn}</div> : null}
      </div>

      {geo && first && last ? (
        <section className={styles.hcChart} aria-label={labels.chartTitle}>
          <div className={styles.hcChartHead}>
            <h3 className={styles.hcChartTitle}>{labels.chartTitle}</h3>
            {ranges.length > 1 ? (
              <div className={styles.hcRanges} role="group" aria-label={labels.rangeAria}>
                {ranges.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.hcRange} ${key === range ? styles.hcRangeOn : ""}`}
                    aria-pressed={key === range}
                    onClick={() => {
                      setRange(key);
                      setHover(null);
                    }}
                  >
                    {labels.ranges[key]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.hcDeltaRow}>
            <span className={`${styles.hcDelta} ${up ? styles.hcUp : styles.hcDown}`}>
              {change != null ? format.percent(change, 1, true) : "N/D"}
            </span>
            <span className={styles.hcDeltaSub}>
              {labels.overPeriod.replace("{period}", labels.periodNames[range])}
            </span>
          </div>

          <div
            ref={plotRef}
            className={styles.hcPlot}
            onPointerMove={(e) => onMove(e.clientX)}
            onPointerDown={(e) => onMove(e.clientX)}
            onPointerLeave={() => setHover(null)}
          >
            <svg
              className={styles.hcSvg}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${labels.chartTitle} — ${dateFmt(first.time)} → ${dateFmt(last.time)}: ${lvl(first.value)} → ${lvl(last.value)}`}
            >
              <defs>
                <linearGradient id={`hc-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a843" stopOpacity="0.34" />
                  <stop offset="60%" stopColor={up ? "#4ade80" : "#ef4444"} stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#d4a843" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" x2={VIEW_W} y1={(geo.yPctOfMax / 100) * VIEW_H} y2={(geo.yPctOfMax / 100) * VIEW_H} className={styles.hcGrid} />
              <line x1="0" x2={VIEW_W} y1={(geo.yPctOfMin / 100) * VIEW_H} y2={(geo.yPctOfMin / 100) * VIEW_H} className={styles.hcGrid} />
              <path d={geo.areaPath} fill={`url(#hc-fill-${gradId})`} />
              <path
                d={geo.linePath}
                fill="none"
                stroke="#d4a843"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <span className={styles.hcYLabel} style={{ top: `${geo.yPctOfMax}%` }}>
              {labels.high} {lvl(geo.dataMax)}
            </span>
            <span className={`${styles.hcYLabel} ${styles.hcYLabelLow}`} style={{ top: `${geo.yPctOfMin}%` }}>
              {labels.low} {lvl(geo.dataMin)}
            </span>

            <span className={`${styles.hcDot} ${styles.hcDotEnd}`} style={{ left: "100%", top: `${geo.yPct[geo.yPct.length - 1]}%` }} />

            {hovered ? (
              <>
                <span className={styles.hcCursor} style={{ left: `${hoverX}%` }} />
                <span className={styles.hcDot} style={{ left: `${hoverX}%`, top: `${hoverY}%` }} />
                <div
                  className={styles.hcTip}
                  style={{
                    left: `${Math.min(86, Math.max(14, hoverX))}%`,
                    top: `${Math.max(0, hoverY - 4)}%`,
                  }}
                >
                  <strong>{lvl(hovered.value)}</strong>
                  <span>{dateFmt(hovered.time)}</span>
                </div>
              </>
            ) : null}
          </div>

          <div className={styles.hcAxis}>
            <div className={styles.hcAxisItem}>
              <span className={styles.hcAxisKey}>{labels.start}</span>
              <span className={styles.hcAxisDate}>{dateFmt(first.time)}</span>
              <strong>{lvl(first.value)}</strong>
            </div>
            <div className={`${styles.hcAxisItem} ${styles.hcAxisEnd}`}>
              <span className={styles.hcAxisKey}>{labels.end}</span>
              <span className={styles.hcAxisDate}>{dateFmt(last.time)}</span>
              <strong>{lvl(last.value)}</strong>
            </div>
          </div>
          <p className={styles.hcSource}>{labels.chartSource}</p>
        </section>
      ) : (
        <p className={styles.hcEmpty}>{labels.noChart}</p>
      )}

      <ul className={styles.figureMeta}>
        {labels.stats.map((stat) => (
          <li key={stat.label} title={stat.title}>
            <strong>{stat.value}</strong>
            {stat.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
