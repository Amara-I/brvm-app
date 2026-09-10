import type { EducationIllustrationId } from "@/lib/education/catalog";
import styles from "./Education.module.css";

/** Schémas pédagogiques SVG (pas de cours réels inventés). */
export default function EducationIllustration({ id }: { id: EducationIllustrationId }) {
  return (
    <figure className={styles.illustration} aria-label={CAPTIONS[id]}>
      <svg viewBox="0 0 360 160" role="img" className={styles.illustrationSvg}>
        <title>{CAPTIONS[id]}</title>
        {id === "rsi" && <RsiSvg />}
        {id === "macd" && <MacdSvg />}
        {id === "sma-cross" && <SmaCrossSvg />}
        {id === "bollinger" && <BollingerSvg />}
        {id === "per-schema" && <PerSvg />}
        {id === "parcours-analyse" && <ParcoursSvg />}
        {id === "nav-app" && <NavSvg />}
      </svg>
      <figcaption className={styles.illustrationCap}>{CAPTIONS[id]}</figcaption>
    </figure>
  );
}

const CAPTIONS: Record<EducationIllustrationId, string> = {
  rsi: "RSI 14 : oscillateur 0–100 (Wilder). Repères usuels ~30 (survente) et ~70 (surachat) — des guides, pas des seuils absolus.",
  macd: "MACD : ligne MACD, signal et histogramme (écart entre les deux).",
  "sma-cross": "Croisement de moyennes mobiles (ex. SMA courte vs SMA longue).",
  bollinger: "Bandes de Bollinger : moyenne centrale et enveloppe ± écarts-types.",
  "per-schema": "PER = cours ÷ bénéfice par action (lecture relative).",
  "parcours-analyse": "Parcours : contexte → fondamentaux → valorisation → technique → signal.",
  "nav-app": "Navigation OuestBourse : menus principaux de l’application.",
};

function axis() {
  return (
    <>
      <line x1="28" y1="20" x2="28" y2="130" stroke="var(--c-border)" strokeWidth="1" />
      <line x1="28" y1="130" x2="340" y2="130" stroke="var(--c-border)" strokeWidth="1" />
    </>
  );
}

function RsiSvg() {
  return (
    <>
      {axis()}
      <line x1="28" y1="40" x2="340" y2="40" stroke="var(--c-red)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <line x1="28" y1="100" x2="340" y2="100" stroke="var(--c-green)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <text x="332" y="38" textAnchor="end" fontSize="10" fill="var(--c-textdim)">
        70
      </text>
      <text x="332" y="98" textAnchor="end" fontSize="10" fill="var(--c-textdim)">
        30
      </text>
      <path
        d="M40 90 C70 95, 90 110, 120 105 S170 70, 200 55 S250 35, 280 50 S320 85, 335 75"
        fill="none"
        stroke="var(--c-purple)"
        strokeWidth="2.2"
      />
      <text x="40" y="18" fontSize="11" fill="var(--c-text)" fontWeight="700">
        RSI 14
      </text>
    </>
  );
}

function MacdSvg() {
  return (
    <>
      {axis()}
      <line x1="28" y1="75" x2="340" y2="75" stroke="var(--c-border)" strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const x = 50 + i * 28;
        const h = i < 5 ? 18 + i * 4 : 30 - (i - 5) * 6;
        const up = i < 6;
        return (
          <rect
            key={i}
            x={x}
            y={up ? 75 - h : 75}
            width="14"
            height={Math.abs(h)}
            fill={up ? "var(--c-green)" : "var(--c-red)"}
            opacity="0.55"
          />
        );
      })}
      <path
        d="M40 95 C80 88, 120 70, 160 62 S240 55, 300 68"
        fill="none"
        stroke="var(--c-teal)"
        strokeWidth="2"
      />
      <path
        d="M40 100 C90 96, 130 80, 180 72 S260 68, 300 78"
        fill="none"
        stroke="var(--c-gold)"
        strokeWidth="1.6"
      />
      <text x="40" y="18" fontSize="11" fill="var(--c-text)" fontWeight="700">
        MACD · Signal · Hist.
      </text>
    </>
  );
}

function SmaCrossSvg() {
  return (
    <>
      {axis()}
      <path
        d="M40 110 C90 100, 140 95, 180 70 S260 40, 330 35"
        fill="none"
        stroke="var(--c-text)"
        strokeWidth="1.4"
        opacity="0.45"
      />
      <path
        d="M40 105 C100 98, 160 90, 210 78 S290 55, 330 50"
        fill="none"
        stroke="var(--c-gold)"
        strokeWidth="2.2"
      />
      <path
        d="M40 100 C110 96, 170 92, 230 85 S300 72, 330 68"
        fill="none"
        stroke="var(--c-blue)"
        strokeWidth="2"
      />
      <circle cx="210" cy="80" r="5" fill="var(--c-green)" />
      <text x="218" y="72" fontSize="10" fill="var(--c-green)">
        croisement
      </text>
      <text x="40" y="18" fontSize="11" fill="var(--c-text)" fontWeight="700">
        SMA courte / SMA longue
      </text>
    </>
  );
}

function BollingerSvg() {
  return (
    <>
      {axis()}
      <path
        d="M40 55 C100 40, 160 50, 220 45 S300 35, 335 42"
        fill="none"
        stroke="var(--c-purple)"
        strokeWidth="1.4"
        strokeDasharray="3 3"
      />
      <path
        d="M40 85 C100 80, 160 82, 220 78 S300 72, 335 75"
        fill="none"
        stroke="var(--c-gold)"
        strokeWidth="2"
      />
      <path
        d="M40 115 C100 120, 160 112, 220 110 S300 108, 335 112"
        fill="none"
        stroke="var(--c-purple)"
        strokeWidth="1.4"
        strokeDasharray="3 3"
      />
      <text x="40" y="18" fontSize="11" fill="var(--c-text)" fontWeight="700">
        Bollinger (20, 2)
      </text>
    </>
  );
}

function PerSvg() {
  return (
    <>
      <rect x="30" y="40" width="90" height="70" rx="8" fill="var(--c-panel)" stroke="var(--c-border)" />
      <text x="75" y="72" textAnchor="middle" fontSize="12" fill="var(--c-text)" fontWeight="700">
        Cours
      </text>
      <text x="75" y="90" textAnchor="middle" fontSize="10" fill="var(--c-textdim)">
        (FCFA)
      </text>
      <text x="140" y="80" fontSize="22" fill="var(--c-gold)" fontWeight="700">
        ÷
      </text>
      <rect x="165" y="40" width="90" height="70" rx="8" fill="var(--c-panel)" stroke="var(--c-border)" />
      <text x="210" y="72" textAnchor="middle" fontSize="12" fill="var(--c-text)" fontWeight="700">
        BPA
      </text>
      <text x="210" y="90" textAnchor="middle" fontSize="10" fill="var(--c-textdim)">
        (bénéfice / action)
      </text>
      <text x="275" y="80" fontSize="22" fill="var(--c-gold)" fontWeight="700">
        =
      </text>
      <rect x="295" y="40" width="50" height="70" rx="8" fill="var(--c-green)" opacity="0.2" stroke="var(--c-green)" />
      <text x="320" y="80" textAnchor="middle" fontSize="13" fill="var(--c-green)" fontWeight="700">
        PER
      </text>
      <text x="30" y="140" fontSize="11" fill="var(--c-textdim)">
        Schéma pédagogique — comparer dans le même secteur.
      </text>
    </>
  );
}

function ParcoursSvg() {
  const steps = ["Contexte", "Fondam.", "Valorisation", "Technique", "Signal"];
  return (
    <>
      {steps.map((label, i) => {
        const x = 28 + i * 66;
        return (
          <g key={label}>
            <rect
              x={x}
              y="50"
              width="56"
              height="44"
              rx="8"
              fill="var(--c-panel)"
              stroke={i === 4 ? "var(--c-gold)" : "var(--c-border)"}
              strokeWidth={i === 4 ? 2 : 1}
            />
            <text x={x + 28} y="76" textAnchor="middle" fontSize="10" fill="var(--c-text)" fontWeight="700">
              {label}
            </text>
            {i < steps.length - 1 && (
              <path d={`M${x + 58} 72 L${x + 64} 72`} stroke="var(--c-textdim)" strokeWidth="1.5" markerEnd="url(#arrow)" />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--c-textdim)" />
        </marker>
      </defs>
      <text x="28" y="130" fontSize="11" fill="var(--c-textdim)">
        Chaque étape peut conclure N/D si la donnée manque.
      </text>
    </>
  );
}

function NavSvg() {
  const items = ["Accueil", "Marché", "Screener", "Graphes", "Portefeuille"];
  return (
    <>
      <rect x="20" y="28" width="320" height="36" rx="8" fill="var(--c-panel)" stroke="var(--c-border)" />
      {items.map((label, i) => (
        <text key={label} x={36 + i * 62} y="51" fontSize="10" fill="var(--c-text)" fontWeight="600">
          {label}
        </text>
      ))}
      <rect x="20" y="80" width="100" height="50" rx="8" fill="var(--c-panel)" stroke="var(--c-green)" />
      <text x="70" y="110" textAnchor="middle" fontSize="11" fill="var(--c-green)" fontWeight="700">
        Contenu
      </text>
      <text x="140" y="108" fontSize="11" fill="var(--c-textdim)">
        Header commun → pages internes
      </text>
    </>
  );
}
