import styles from "./Landing.module.css";

/**
 * Décor du hero : silhouette filaire de l'Afrique + overlay chandelier/courbe.
 * Purement ornemental (aria-hidden) — aucun chiffre de marché.
 */
export default function AfricaHeroBackdrop() {
  /* Projection approximative lon/lat → vue 760×860 (filaire, pas un fond plein). */
  const continent =
    "M186 80 L248 70 L310 88 L337 121 L400 128 L443 131 L455 170 L470 222 L496 283 L560 300 L611 323 L590 370 L541 425 L514 476 L505 516 L488 580 L470 628 L440 720 L408 780 L360 798 L319 800 L290 740 L266 679 L270 620 L275 567 L266 496 L239 445 L210 420 L230 405 L180 400 L151 394 L124 394 L96 340 L89 303 L98 232 L130 180 L151 151 Z";
  const madagascar = "M576 620 L598 638 L590 698 L560 710 L548 668 Z";

  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroGlow} />
      <div className={styles.heroGlowSoft} />
      <div className={styles.heroGrid} />
      <svg className={styles.africaMap} viewBox="0 0 760 860" fill="none">
        <defs>
          <linearGradient id="lp-africa-stroke" x1="80" y1="40" x2="680" y2="800" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8DE9A" />
            <stop offset="50%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#8A6A2C" />
          </linearGradient>
          <filter id="lp-africa-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className={styles.africaFill} d={continent} />
        <path className={styles.africaStroke} filter="url(#lp-africa-glow)" d={continent} />
        <path className={styles.africaStroke} d={madagascar} />
        <g className={styles.africaWires}>
          <path d="M210 210 C300 190 400 200 500 250" />
          <path d="M160 320 C260 300 380 320 560 380" />
          <path d="M140 430 C250 420 370 450 520 520" />
          <path d="M200 540 C300 560 390 620 450 720" />
          <path d="M360 90 C350 220 340 380 360 560 C380 680 410 760 430 790" />
          <path d="M470 140 C455 260 500 360 560 430" />
        </g>
        <g className={styles.africaDots} fill="#F3D27A">
          <circle cx="260" cy="160" r="2.2" />
          <circle cx="360" cy="140" r="1.8" />
          <circle cx="460" cy="190" r="2" />
          <circle cx="540" cy="280" r="1.7" />
          <circle cx="610" cy="370" r="2" />
          <circle cx="400" cy="300" r="2.4" />
          <circle cx="280" cy="340" r="1.8" />
          <circle cx="190" cy="300" r="1.6" />
          <circle cx="350" cy="430" r="2.1" />
          <circle cx="280" cy="540" r="1.8" />
          <circle cx="400" cy="620" r="1.7" />
          <circle cx="420" cy="730" r="1.5" />
        </g>
      </svg>

      <svg className={styles.chartOverlay} viewBox="0 0 560 240" fill="none">
        <defs>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.25" />
            <stop offset="40%" stopColor="#F6D889" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.2" />
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
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {[
          [48, 158, 30],
          [94, 134, 36],
          [140, 148, 26],
          [186, 108, 42],
          [232, 96, 34],
          [278, 70, 40],
          [324, 88, 30],
          [370, 62, 38],
          [416, 50, 28],
          [462, 44, 36],
          [508, 28, 26],
        ].map(([x, close, size], i) => {
          const up = i % 3 !== 1;
          const body = size * 0.44;
          const color = up ? "#22C55E" : "#E2BD5C";
          const top = close - size / 2;
          return (
            <g key={x} opacity={0.8}>
              <path d={`M${x} ${top} V${top + size}`} stroke={color} strokeWidth="1.3" />
              <rect
                x={x - 4.5}
                y={up ? close - body * 0.18 : close - body * 0.72}
                width="9"
                height={body}
                rx="1.2"
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
