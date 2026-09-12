import styles from "./Landing.module.css";

/**
 * Décor du hero : silhouette filaire de l'Afrique + overlay chandelier/courbe.
 * Purement ornemental (aria-hidden) — aucun chiffre de marché.
 */
export default function AfricaHeroBackdrop() {
  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroGlow} />
      <div className={styles.heroGrid} />
      <svg className={styles.africaMap} viewBox="0 0 600 680" fill="none">
        <defs>
          <linearGradient id="lp-africa-stroke" x1="80" y1="40" x2="540" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F3D27A" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#D4A843" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#8A6A2C" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="lp-africa-fill" x1="300" y1="40" x2="300" y2="660" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.02" />
          </linearGradient>
          <filter id="lp-africa-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className={styles.africaFill}
          d="M176 78c46-26 112-36 168-26 48 8 92 32 118 68 16 22 20 50 12 76 8 18 28 30 54 42 28 14 52 34 58 64 8 38-12 70-42 88-18 12-28 32-24 54 6 30-6 60-32 80-22 18-42 44-56 74-16 34-42 56-78 60-38 4-70-16-88-46-14-24-20-54-28-82-10-32-34-56-62-70-30-16-58-40-66-74-8-36 6-70 2-104-4-32-28-56-32-90-4-36 16-68 44-90 22-18 50-26 82-24z"
        />
        <path
          className={styles.africaStroke}
          filter="url(#lp-africa-glow)"
          d="M176 78c46-26 112-36 168-26 48 8 92 32 118 68 16 22 20 50 12 76 8 18 28 30 54 42 28 14 52 34 58 64 8 38-12 70-42 88-18 12-28 32-24 54 6 30-6 60-32 80-22 18-42 44-56 74-16 34-42 56-78 60-38 4-70-16-88-46-14-24-20-54-28-82-10-32-34-56-62-70-30-16-58-40-66-74-8-36 6-70 2-104-4-32-28-56-32-90-4-36 16-68 44-90 22-18 50-26 82-24z"
        />
        <path
          className={styles.africaStroke}
          d="M508 438c18 8 32 28 26 50-8 24-32 34-52 22-18-10-22-36-10-52 10-14 22-22 36-20z"
        />
        <g className={styles.africaDots} fill="#D4A843">
          <circle cx="248" cy="168" r="2.2" />
          <circle cx="318" cy="148" r="1.8" />
          <circle cx="392" cy="196" r="2" />
          <circle cx="448" cy="248" r="1.6" />
          <circle cx="360" cy="286" r="2.4" />
          <circle cx="292" cy="320" r="1.7" />
          <circle cx="220" cy="300" r="1.5" />
          <circle cx="338" cy="390" r="2.1" />
          <circle cx="286" cy="468" r="1.8" />
          <circle cx="348" cy="520" r="1.6" />
        </g>
      </svg>

      <svg className={styles.chartOverlay} viewBox="0 0 520 220" fill="none">
        <defs>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#F3D27A" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M8 168 C48 162 62 148 86 132 C110 116 124 148 148 128 C172 108 186 86 210 98 C234 110 248 74 276 68 C304 62 318 96 346 78 C374 60 392 42 418 50 C444 58 458 36 486 28 L512 22 V210 H8 Z"
          fill="url(#lp-chart-fill)"
        />
        <path
          d="M8 168 C48 162 62 148 86 132 C110 116 124 148 148 128 C172 108 186 86 210 98 C234 110 248 74 276 68 C304 62 318 96 346 78 C374 60 392 42 418 50 C444 58 458 36 486 28 L512 22"
          stroke="url(#lp-chart-line)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {[
          [42, 150, 28],
          [86, 128, 34],
          [130, 142, 26],
          [174, 108, 40],
          [218, 96, 32],
          [262, 74, 38],
          [306, 88, 30],
          [350, 64, 36],
          [394, 52, 28],
          [438, 44, 34],
          [482, 30, 26],
        ].map(([x, close, size], i) => {
          const up = i % 3 !== 1;
          const body = size * 0.42;
          const color = up ? "#22C55E" : "#D4A843";
          const top = close - size / 2;
          return (
            <g key={x} opacity={0.72}>
              <path d={`M${x} ${top} V${top + size}`} stroke={color} strokeWidth="1.2" />
              <rect
                x={x - 4}
                y={up ? close - body * 0.15 : close - body * 0.7}
                width="8"
                height={body}
                rx="1"
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
