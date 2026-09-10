import Link from "next/link";
import styles from "./AnalysisRecap.module.css";

export interface AnalysisRecapProps {
  kind: "fundamental" | "technical";
  signalLabel: string;
  signalColor: string;
  score: number;
  confidence?: string;
  summary: string;
  lines: string[];
  href?: string;
  hrefLabel?: string;
}

/**
 * Récapitulatif d'analyse compact — style éditorial (pas d'encadré "or IA").
 */
export default function AnalysisRecap({
  kind,
  signalLabel,
  signalColor,
  score,
  confidence,
  summary,
  lines,
  href,
  hrefLabel,
}: AnalysisRecapProps) {
  const title = kind === "fundamental" ? "Analyse fondamentale" : "Analyse graphique";

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.signal} style={{ color: signalColor }}>
          {signalLabel}
        </span>
        <span className={styles.score}>
          {score}/100
          {confidence ? ` · ${confidence}` : ""}
        </span>
      </div>
      <p className={styles.summary}>{summary || "N/D"}</p>
      {lines.length > 0 && (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {href && (
        <Link href={href} className={styles.link}>
          {hrefLabel ?? "Voir le détail →"}
        </Link>
      )}
    </div>
  );
}
