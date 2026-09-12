import styles from "./Landing.module.css";

/**
 * Décor du hero : Afrique en pointillés + chandelier/courbe or.
 * Purement ornemental (aria-hidden) — aucun chiffre de marché.
 */
export default function AfricaHeroBackdrop() {
  const continent =
    "M186 80 L248 70 L310 88 L337 121 L400 128 L443 131 L455 170 L470 222 L496 283 L560 300 L611 323 L590 370 L541 425 L514 476 L505 516 L488 580 L470 628 L440 720 L408 780 L360 798 L319 800 L290 740 L266 679 L270 620 L275 567 L266 496 L239 445 L210 420 L230 405 L180 400 L151 394 L124 394 L96 340 L89 303 L98 232 L130 180 L151 151 Z";
  const madagascar = "M576 620 L598 638 L590 698 L560 710 L548 668 Z";

  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroGlow} />
      <div className={styles.heroGlowSoft} />
      <svg className={styles.africaMap} viewBox="0 0 760 860" fill="none">
        <defs>
          <pattern id="lp-africa-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.1" cy="1.1" r="0.72" fill="#D4A843" opacity="0.42" />
          </pattern>
          <clipPath id="lp-africa-clip">
            <path d={continent} />
            <path d={madagascar} />
          </clipPath>
          <linearGradient id="lp-africa-stroke" x1="80" y1="40" x2="680" y2="800" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8DE9A" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#D4A843" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8A6A2C" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect width="760" height="860" fill="url(#lp-africa-dots)" clipPath="url(#lp-africa-clip)" />
        <path className={styles.africaStroke} d={continent} />
        <path className={styles.africaStroke} d={madagascar} />
      </svg>

      <svg className={styles.chartOverlay} viewBox="0 0 560 240" fill="none">
        <defs>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#F6D889" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M10 178 C52 170 68 154 94 136 C122 116 138 152 164 132 C192 110 208 86 234 98 C260 110 276 72 306 64 C336 56 352 96 382 76 C412 56 432 38 460 48 C488 58 504 34 534 26 L552 22 V228 H10 Z"
          fill="url(#lp-chart-fill)"
        />
        <path
          d="M10 178 C52 170 68 154 94 136 C122 116 138 152 164 132 C192 110 208 86 234 98 C260 110 276 72 306 64 C336 56 352 96 382 76 C412 56 432 38 460 48 C488 58 504 34 534 26 L552 22"
          stroke="url(#lp-chart-line)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        {[
          [48, 158, 26],
          [94, 134, 32],
          [140, 148, 22],
          [186, 108, 36],
          [232, 96, 28],
          [278, 70, 34],
          [324, 88, 26],
          [370, 62, 32],
          [416, 50, 24],
          [462, 44, 30],
          [508, 28, 22],
        ].map(([x, close, size], i) => {
          const up = i % 3 !== 1;
          const body = size * 0.4;
          const color = up ? "#22C55E" : "#E2BD5C";
          const top = close - size / 2;
          return (
            <g key={x} opacity={0.72}>
              <path d={`M${x} ${top} V${top + size}`} stroke={color} strokeWidth="0.9" />
              <rect
                x={x - 3.2}
                y={up ? close - body * 0.18 : close - body * 0.72}
                width="6.4"
                height={body}
                rx="0.8"
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
