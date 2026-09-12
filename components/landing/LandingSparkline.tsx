import { downsampleSeries } from "@/lib/landing/price-series";
import styles from "./Landing.module.css";

export default function LandingSparkline({
  values,
  width = 64,
  height = 22,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className={styles.sparkNd}>N/D</span>;
  }

  const sampled = downsampleSeries(values);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || Math.max(Math.abs(max) * 0.02, 1);
  const padX = 1;
  const padY = 2;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const n = sampled.length;
  const up = sampled[sampled.length - 1]! >= sampled[0]!;
  const stroke = up ? "#22c55e" : "#ef4444";

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

  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <polyline fill={up ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.12)"} stroke="none" points={fill} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}
