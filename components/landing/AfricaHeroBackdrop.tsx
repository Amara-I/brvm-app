import styles from "./Landing.module.css";

/**
 * Texture de fond : Afrique en pointillés, quasi invisible.
 * Purement ornemental (aria-hidden) — aucun chiffre de marché.
 */
export default function AfricaHeroBackdrop() {
  const continent =
    "M186 80 L248 70 L310 88 L337 121 L400 128 L443 131 L455 170 L470 222 L496 283 L560 300 L611 323 L590 370 L541 425 L514 476 L505 516 L488 580 L470 628 L440 720 L408 780 L360 798 L319 800 L290 740 L266 679 L270 620 L275 567 L266 496 L239 445 L210 420 L230 405 L180 400 L151 394 L124 394 L96 340 L89 303 L98 232 L130 180 L151 151 Z";
  const madagascar = "M576 620 L598 638 L590 698 L560 710 L548 668 Z";

  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroGlow} />
      <svg className={styles.africaMap} viewBox="0 0 760 860" fill="none">
        <defs>
          <pattern id="lp-africa-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.58" fill="#D4A843" opacity="0.62" />
          </pattern>
          <clipPath id="lp-africa-clip">
            <path d={continent} />
            <path d={madagascar} />
          </clipPath>
        </defs>
        <rect width="760" height="860" fill="url(#lp-africa-dots)" clipPath="url(#lp-africa-clip)" />
      </svg>

      <svg className={styles.chartOverlay} viewBox="0 0 560 240" fill="none">
        <defs>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {[
          [40, 150, 22],
          [78, 128, 28],
          [116, 140, 18],
          [154, 104, 30],
          [192, 92, 24],
          [230, 70, 28],
          [268, 84, 20],
          [306, 58, 26],
        ].map(([x, close, size], i) => {
          const up = i % 3 !== 1;
          const body = size * 0.38;
          const color = up ? "#D4A843" : "#8A6A2C";
          const top = close - size / 2;
          return (
            <g key={x} opacity={0.45}>
              <path d={`M${x} ${top} V${top + size}`} stroke={color} strokeWidth="0.7" />
              <rect
                x={x - 2.4}
                y={up ? close - body * 0.18 : close - body * 0.72}
                width="4.8"
                height={body}
                rx="0.6"
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
