// Bloc « Note NGX sur 100 » de la section 8 : note globale, mode (complet / technique seul),
// confiance, six piliers avec leurs critères, et la grille de pondération par politique.
// Composant serveur, sans état ; tout vient de model.score (lib/ngx/score.ts).

import type { getI18n } from "@/lib/i18n/get-i18n";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
import { getPortfolioTypeDef } from "@/lib/portfolio-types/catalog";
import { PORTFOLIO_TYPE_IDS } from "@/lib/portfolio-types/constants";
import {
  NGX_PILLAR_KEYS,
  NGX_POLICY_REQUIRED,
  NGX_SCORE_WEIGHTS,
  type NgxPillar,
  type NgxScore,
  type NgxScoreBand,
  type NgxScoreComponent,
} from "@/lib/ngx/score";
import styles from "./NgxSheet.module.css";

type Fmt = ReturnType<typeof getI18n>["format"];
type T = ReturnType<typeof getI18n>["t"];
type ComponentKey =
  | "revenueCagr"
  | "netIncomeCagr"
  | "revenueYoy"
  | "roe"
  | "netMargin"
  | "consistency"
  | "per"
  | "perVsSector"
  | "pbr"
  | "pbrVsSector"
  | "fairValueGap"
  | "dividendYield"
  | "dividendRegularity"
  | "payout"
  | "dividendGrowth"
  | "trend"
  | "momentum3m"
  | "momentum1y"
  | "drawdown"
  | "volatility"
  | "liquidity";

export function bandTone(band: NgxScoreBand | null): string {
  if (band === "HIGH") return styles.good;
  if (band === "GOOD") return styles.mid;
  if (band === "LOW") return styles.bad;
  return "";
}

function formatComponent(c: NgxScoreComponent, format: Fmt, t: T): string {
  if (c.value == null)
    return c.key === "trend" ? "" : t("ngx.sheet.score.negative");
  switch (c.key) {
    case "per":
    case "pbr":
      return `${format.decimal(c.value, 1)}×`;
    case "dividendRegularity":
      return format.integer(c.value);
    case "liquidity":
      return `${format.decimal(c.value / 1_000_000, 1)} M ₦`;
    case "fairValueGap":
    case "perVsSector":
    case "pbrVsSector":
    case "dividendGrowth":
    case "revenueCagr":
    case "netIncomeCagr":
    case "revenueYoy":
    case "momentum3m":
    case "momentum1y":
    case "drawdown":
      return format.percent(c.value, 1, true);
    case "consistency":
      return format.percent(c.value, 0);
    default:
      return format.percent(c.value, 1);
  }
}

function PillarCard({
  pillar,
  weight,
  t,
  format,
}: {
  pillar: NgxPillar;
  weight: number;
  t: T;
  format: Fmt;
}) {
  const score = pillar.score;
  const band: NgxScoreBand | null =
    score == null
      ? null
      : score >= 65
        ? "HIGH"
        : score >= 50
          ? "GOOD"
          : score >= 35
            ? "MIXED"
            : "LOW";
  return (
    <article
      className={`${styles.card} ${styles.pillar}`}
      data-pillar={pillar.key}
    >
      <header>
        <h4>{t(`ngx.sheet.score.pillar.${pillar.key}`)}</h4>
        <span className={`${styles.badge} ${bandTone(band)}`}>
          {score == null ? t("ngx.sheet.score.nd") : format.integer(score)}
        </span>
      </header>
      <div className={styles.scoreBar} aria-hidden="true">
        <span className={bandTone(band)} style={{ width: `${score ?? 0}%` }} />
      </div>
      <p className={styles.policySummary}>
        {t("ngx.sheet.score.weight", {
          percent: format.percent(weight * 100, 0),
        })}
        {score != null && pillar.reliability != null && pillar.reliability < 1
          ? ` · ${t("ngx.sheet.score.unconfirmed")}`
          : ""}
      </p>
      {pillar.components.length === 0 ? (
        <p className={styles.policySummary}>{t("ngx.sheet.score.pillarNd")}</p>
      ) : (
        <ul className={styles.criteria}>
          {pillar.components.map((c, i) => {
            const value = formatComponent(c, format, t);
            return (
              <li key={`${c.key}-${i}`}>
                <span className={styles.cLabel}>
                  {t(`ngx.sheet.score.component.${c.key as ComponentKey}`)}
                </span>
                <span className={styles.cValue}>
                  {value ||
                    t("ngx.sheet.score.points", {
                      points: format.integer(c.points),
                    })}
                </span>
                {value ? (
                  <span className={styles.cThreshold}>
                    {t("ngx.sheet.score.points", {
                      points: format.integer(c.points),
                    })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

export default function NgxScoreBlock({
  score,
  t,
  format,
  locale,
}: {
  score: NgxScore;
  t: T;
  format: Fmt;
  locale: "fr" | "en";
}) {
  const hasScore = score.overall != null;
  const visiblePillars = NGX_PILLAR_KEYS.filter(
    (k) =>
      score.pillars[k].components.length > 0 || score.mode !== "CHART_ONLY",
  );
  return (
    <div className={styles.scoreBlock} data-score-mode={score.mode}>
      <h3 className={styles.sub}>{t("ngx.sheet.score.title")}</h3>
      <p className={styles.lead}>{t("ngx.sheet.score.lead")}</p>
      <div className={`${styles.card} ${styles.scoreHero}`}>
        <div className={styles.scoreMain}>
          <span className={styles.scoreLabel}>
            {t("ngx.sheet.score.overall")}
          </span>
          <span
            className={`${styles.scoreBig} ${hasScore ? "" : styles.scoreBigNd}`}
          >
            {hasScore
              ? format.integer(score.overall as number)
              : t("ngx.sheet.score.nd")}
            <small>{t("ngx.sheet.score.outOf")}</small>
          </span>
          {score.band ? (
            <span className={`${styles.badge} ${bandTone(score.band)}`}>
              {t(`ngx.sheet.score.band.${score.band}`)}
            </span>
          ) : null}
        </div>
        <dl className={styles.scoreFacts}>
          <div>
            <dt>{t("ngx.sheet.score.confidenceLabel")}</dt>
            <dd>{t(`ngx.sheet.score.confidence.${score.confidence}`)}</dd>
          </div>
          <div>
            <dt>{t("ngx.sheet.score.modeLabel")}</dt>
            <dd
              className={
                score.mode === "CHART_ONLY" ? styles.scoreChartOnly : undefined
              }
            >
              {t(`ngx.sheet.score.mode.${score.mode}`)}
            </dd>
          </div>
        </dl>
      </div>
      {score.mode === "CHART_ONLY" ? (
        <p className={styles.disclaimer}>
          {t("ngx.sheet.score.chartOnlyNote")}
        </p>
      ) : null}
      {score.staleAccountsYear != null ? (
        <p className={styles.disclaimer}>
          {t("ngx.sheet.score.staleNote", { year: score.staleAccountsYear })}
        </p>
      ) : null}
      {score.mode === "NONE" ? (
        <p className={styles.disclaimer}>{t("ngx.sheet.score.noneNote")}</p>
      ) : null}
      {score.confirmedShare != null ? (
        <p className={styles.policySummary}>
          {t("ngx.sheet.score.confirmed", {
            percent: format.percent(score.confirmedShare * 100, 0),
          })}
        </p>
      ) : null}

      {score.mode !== "NONE" ? (
        <>
          <h3 className={styles.sub}>{t("ngx.sheet.score.pillarsTitle")}</h3>
          <div className={styles.pillars}>
            {visiblePillars.map((k) => (
              <PillarCard
                key={k}
                pillar={score.pillars[k]}
                weight={NGX_SCORE_WEIGHTS.OVERALL[k]}
                t={t}
                format={format}
              />
            ))}
          </div>
        </>
      ) : null}

      <details className={styles.weights}>
        <summary>{t("ngx.sheet.score.weightsTitle")}</summary>
        <div className={styles.weightsWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col" />
                {NGX_PILLAR_KEYS.map((k) => (
                  <th key={k} scope="col">
                    {t(`ngx.sheet.score.pillar.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["OVERALL", ...PORTFOLIO_TYPE_IDS] as const).map((key) => (
                <tr key={key}>
                  <th scope="row">
                    {key === "OVERALL"
                      ? t("ngx.sheet.score.weightsOverall")
                      : localizedTypeDef(getPortfolioTypeDef(key), locale)
                          .label}
                  </th>
                  {NGX_PILLAR_KEYS.map((k) => {
                    const w = NGX_SCORE_WEIGHTS[key][k];
                    const required =
                      key !== "OVERALL" && NGX_POLICY_REQUIRED[key].includes(k);
                    return (
                      <td
                        key={k}
                        className={required ? styles.weightRequired : undefined}
                        title={
                          required
                            ? t("ngx.sheet.score.requiredMark")
                            : undefined
                        }
                      >
                        {w === 0 ? "—" : format.percent(w * 100, 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.policySummary}>
          {t("ngx.sheet.score.weightsNote")}
        </p>
      </details>
    </div>
  );
}
