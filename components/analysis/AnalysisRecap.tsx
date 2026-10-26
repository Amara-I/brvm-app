"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
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
  const { t, labels } = useI18n();
  const title = kind === "fundamental" ? t("company.recap.fundamental") : t("company.recap.technical");
  const shownSignal =
    signalLabel === "ACHAT FORT" ||
    signalLabel === "ACHAT" ||
    signalLabel === "CONSERVER" ||
    signalLabel === "ALLÉGER" ||
    signalLabel === "VENDRE" ||
    signalLabel === "N/D"
      ? labels.signal(signalLabel)
      : signalLabel;
  const shownConfidence =
    confidence === "Élevée" || confidence === "Moyenne" || confidence === "Faible"
      ? labels.confidence(confidence)
      : confidence;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.signal} style={{ color: signalColor }}>
          {shownSignal}
        </span>
        <span className={styles.score}>
          {score}/100
          {shownConfidence ? ` · ${shownConfidence}` : ""}
        </span>
      </div>
      <p className={styles.summary}>{summary || t("common.nd")}</p>
      {lines.length > 0 && (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {href && (
        <Link href={href} className={styles.link}>
          {hrefLabel ?? t("company.recap.detail")}
        </Link>
      )}
    </div>
  );
}
