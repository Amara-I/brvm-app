import styles from "./Landing.module.css";

/**
 * Décor du hero : silhouette filaire de l'Afrique + overlay chandelier/courbe.
 * Purement ornemental (aria-hidden) — aucun chiffre de marché.
 */
export default function AfricaHeroBackdrop() {
  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroGlow} />
      <div className={styles.heroGlowSoft} />
      <div className={styles.heroGrid} />
      <svg className={styles.africaMap} viewBox="0 0 720 820" fill="none">
        <defs>
          <linearGradient id="lp-africa-stroke" x1="80" y1="40" x2="640" y2="780" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F6D889" />
            <stop offset="45%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#8A6A2C" />
          </linearGradient>
          <linearGradient id="lp-africa-fill" x1="360" y1="40" x2="360" y2="800" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.03" />
          </linearGradient>
          <filter id="lp-africa-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Continent : Maghreb → Égypte → Corne → Cap → golfe de Guinée. */}
        <path
          className={styles.africaFill}
          d="M168 118
            C228 72 318 58 398 70
            C468 80 538 108 572 156
            C592 186 586 228 568 262
            C556 286 572 312 618 338
            C668 368 708 412 698 468
            C690 512 652 538 618 568
            C588 594 572 640 556 688
            C540 736 508 778 456 798
            C404 818 348 808 312 768
            C284 736 274 688 258 640
            C244 598 214 560 176 532
            C132 500 96 458 88 406
            C80 352 102 312 96 266
            C90 220 58 186 78 148
            C96 118 136 128 168 118 Z"
        />
        <path
          className={styles.africaStroke}
          filter="url(#lp-africa-glow)"
          d="M168 118
            C228 72 318 58 398 70
            C468 80 538 108 572 156
            C592 186 586 228 568 262
            C556 286 572 312 618 338
            C668 368 708 412 698 468
            C690 512 652 538 618 568
            C588 594 572 640 556 688
            C540 736 508 778 456 798
            C404 818 348 808 312 768
            C284 736 274 688 258 640
            C244 598 214 560 176 532
            C132 500 96 458 88 406
            C80 352 102 312 96 266
            C90 220 58 186 78 148
            C96 118 136 128 168 118 Z"
        />
        {/* Madagascar */}
        <path
          className={styles.africaStroke}
          d="M652 548 C678 562 692 598 682 636 C672 672 640 684 618 664 C598 646 608 588 652 548 Z"
        />
        <g className={styles.africaDots} fill="#F3D27A">
          <circle cx="250" cy="168" r="2.4" />
          <circle cx="340" cy="148" r="2" />
          <circle cx="430" cy="188" r="2.2" />
          <circle cx="520" cy="250" r="1.8" />
          <circle cx="610" cy="360" r="2.1" />
          <circle cx="400" cy="300" r="2.6" />
          <circle cx="300" cy="340" r="1.9" />
          <circle cx="200" cy="300" r="1.7" />
          <circle cx="360" cy="430" r="2.3" />
          <circle cx="300" cy="540" r="2" />
          <circle cx="400" cy="620" r="1.8" />
          <circle cx="430" cy="720" r="1.6" />
        </g>
      </svg>

      <svg className={styles.chartOverlay} viewBox="0 0 560 240" fill="none">
        <defs>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.2" />
            <stop offset="38%" stopColor="#F6D889" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.28" />
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
          strokeWidth="2.6"
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
            <g key={x} opacity={0.82}>
              <path d={`M${x} ${top} V${top + size}`} stroke={color} strokeWidth="1.35" />
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
