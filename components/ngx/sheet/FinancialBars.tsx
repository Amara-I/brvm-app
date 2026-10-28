// Histogramme annuel (CA, résultat d'exploitation, résultat net) en SVG pur, rendu côté serveur.
// Aucun JavaScript client : la fiche reste légère et accessible (titre + description du SVG).

import type { NgxFinancialYear } from "@/lib/ngx/fundamentals";
import styles from "./NgxSheet.module.css";

interface Props {
  years: NgxFinancialYear[];
  alt: string;
  formatValue: (value: number) => string;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

export default function FinancialBars({ years, alt, formatValue }: Props) {
  const series = [
    { key: "revenueBn" as const, cls: styles.barRevenue },
    { key: "operatingIncomeBn" as const, cls: styles.barOperating },
    { key: "netIncomeBn" as const, cls: styles.barNet },
  ];
  const all = years.flatMap((y) => series.map((s) => y[s.key])).filter((v): v is number => v != null);
  if (all.length === 0) return null;

  const top = niceMax(Math.max(0, ...all));
  const bottom = Math.min(0, ...all) < 0 ? -niceMax(Math.abs(Math.min(...all))) : 0;
  const W = 900;
  const H = 300;
  const padL = 64;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const span = top - bottom;
  const y = (v: number) => padT + ((top - v) / span) * plotH;
  const groupW = plotW / years.length;
  const barW = Math.min(22, (groupW * 0.8) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => bottom + span * f);

  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <title>{alt}</title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={styles.gridLine} x1={padL} x2={W - padR} y1={y(tick)} y2={y(tick)} />
          <text className={styles.tick} x={padL - 8} y={y(tick) + 4} textAnchor="end">
            {formatValue(tick)}
          </text>
        </g>
      ))}
      <line className={styles.axis} x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />
      {years.map((row, gi) => {
        const gx = padL + gi * groupW + (groupW - barW * series.length) / 2;
        return (
          <g key={row.year}>
            {series.map((s, si) => {
              const v = row[s.key];
              if (v == null) return null;
              const y0 = y(0);
              const y1 = y(v);
              const h = Math.max(1, Math.abs(y1 - y0));
              return (
                <rect
                  key={s.key}
                  className={v < 0 ? styles.barNegative : s.cls}
                  x={gx + si * barW}
                  y={v >= 0 ? y1 : y0}
                  width={barW - 2}
                  height={h}
                  rx={2}
                >
                  <title>{`${row.year} · ${formatValue(v)}`}</title>
                </rect>
              );
            })}
            <text className={styles.tick} x={padL + gi * groupW + groupW / 2} y={H - 8} textAnchor="middle">
              {row.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
