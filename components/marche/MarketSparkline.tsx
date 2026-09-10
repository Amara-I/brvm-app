"use client";

/** Aperçu marché : courbe en dents de scie (cours), vert / rouge selon la tendance. */

import { C } from "@/lib/theme/colors";
import styles from "./MarketBoard.module.css";

/** Réduit une série dense tout en gardant min/max pour l'amplitude visuelle. */
function downsample(values: number[], maxPoints = 56): number[] {
  if (values.length <= maxPoints) return values;
  const out: number[] = [];
  const last = values.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * last);
    out.push(values[idx]!);
  }
  const globalMin = Math.min(...values);
  const globalMax = Math.max(...values);
  let hasMin = false;
  let hasMax = false;
  for (const v of out) {
    if (v === globalMin) hasMin = true;
    if (v === globalMax) hasMax = true;
  }
  if (!hasMin) out[Math.floor(out.length / 3)] = globalMin;
  if (!hasMax) out[Math.floor((2 * out.length) / 3)] = globalMax;
  return out;
}

export default function MarketSparkline({
  values,
  width = 200,
  height = 52,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className={styles.sparkNd}>N/D</span>;
  }

  const sampled = downsample(values);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const padX = 1;
  const padY = 3;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const n = sampled.length;

  const points = sampled
    .map((v, i) => {
      const x = padX + (i / (n - 1)) * usableW;
      const y = padY + usableH - ((v - min) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const up = sampled[sampled.length - 1]! >= sampled[0]!;
  const stroke = up ? C.green : C.red;

  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
