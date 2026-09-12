import { downsampleSeries } from "@/lib/landing/price-series";
import styles from "./Landing.module.css";

export default function LandingSparkline({
  values,
  width = 64,
  height = 22,
  variant = "row",
}: {
  values: number[];
  width?: number;
  height?: number;
  variant?: "row" | "hero";
}) {
  if (values.length < 2) {
    return <span className={styles.sparkNd}>N/D</span>;
  }

  const sampled = downsampleSeries(values, variant === "hero" ? 16 : 12);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const padX = 1.5;
  const padY = variant === "hero" ? 4 : 2;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const n = sampled.length;
  const up = sampled[sampled.length - 1]! >= sampled[0]!;
  const stroke = up ? "#4ade80" : "#ef4444";
  const fillColor = up ? "rgba(74,222,128,0.16)" : "rgba(239,68,68,0.1)";

  const coords = sampled.map((value, i) => {
    const x = padX + (i / (n - 1)) * usableW;
    const y = padY + usableH - ((value - min) / span) * usableH;
    return { x, y };
  });
  const line = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1]!;
  const fill = `${padX.toFixed(1)},${(height - padY).toFixed(1)} ${line} ${last.x.toFixed(1)},${(
    height - padY
  ).toFixed(1)}`;
  const glowId = variant === "hero" ? "lp-spark-glow" : undefined;

  return (
    <svg
      className={`${styles.spark} ${variant === "hero" ? styles.sparkHero : ""}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {glowId ? (
        <defs>
          <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      ) : null}
      <polyline fill={fillColor} stroke="none" points={fill} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={variant === "hero" ? 1.7 : 1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
        filter={glowId ? `url(#${glowId})` : undefined}
      />
    </svg>
  );
}
