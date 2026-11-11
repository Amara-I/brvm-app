"use client";

// Panneau d'analyse technique sous le graphe de la fiche (zones, FVG, scénarios).
// Les chiffres viennent de `analyzePriceHistory` — rien n'est inventé.

import SignalBadge from "@/components/ui/SignalBadge";
import ConfidenceDot from "@/components/ui/ConfidenceDot";
import { useMemo, type ReactNode } from "react";
import { signalOf } from "@/lib/calc/calc-metrics";
import EducationTermLink from "@/components/education/EducationTermLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import {
  formatDistancePct,
  formatPrice,
  formatPriceRange,
  rewardRiskSentence,
  type PriceCurrency,
} from "@/lib/technical-analysis/level-label";
import { scenarioChartModel } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioChartMark, ScenarioChartModel } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioBias, ScenarioPlan, TechnicalAnalysis } from "@/lib/technical-analysis/types";
import styles from "./TechnicalAnalysisPanel.module.css";

function markClass(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "support") return styles.markTarget;
  if (kind === "stop" || kind === "resistance") return styles.markStop;
  if (kind === "entry" || kind === "fvg") return styles.markEntry;
  return styles.markLast;
}

function lineClass(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "support") return styles.targetLine;
  if (kind === "stop" || kind === "resistance") return styles.stopLine;
  if (kind === "entry" || kind === "fvg") return styles.entryLine;
  return styles.lastLine;
}

function ScenarioFigure({
  model,
  caption,
  markerId,
  markName,
  money,
  range,
}: {
  model: ScenarioChartModel;
  caption: string;
  markerId: string;
  markName: (mark: ScenarioChartMark) => string;
  money: (value: number) => string;
  range: (low: number, high: number) => string;
}) {
  return (
    <div className={styles.figureWrap}>
      <svg
        className={styles.figure}
        viewBox={`0 0 ${model.width} ${model.height}`}
        role="img"
        aria-label={caption}
      >
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className={styles.arrowHead} />
          </marker>
        </defs>
        <rect width={model.width} height={model.height} className={styles.figureBg} rx="10" />
        {model.zones.map((zone, index) => (
          <rect
            key={`${zone.kind}-${index}`}
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            className={
              zone.kind === "support"
                ? styles.zoneSupport
                : zone.kind === "resistance"
                  ? styles.zoneResistance
                  : zone.kind === "gap"
                    ? styles.zoneGap
                    : styles.zoneEntry
            }
          />
        ))}
        <polyline points={model.polyline} className={styles.priceLine} />
        {model.marks.map((mark, index) => (
          <line
            key={`${mark.kind}-${mark.price}-${index}`}
            x1={12}
            x2={model.width * 0.62}
            y1={mark.y}
            y2={mark.y}
            className={lineClass(mark.kind)}
          />
        ))}
        {model.arrow ? (
          <line
            x1={model.arrow.x1}
            y1={model.arrow.y1}
            x2={model.arrow.x2}
            y2={model.arrow.y2}
            className={styles.arrow}
            markerEnd={`url(#${markerId})`}
          />
        ) : null}
      </svg>
      <ul className={styles.figureLabels}>
        {model.marks.map((mark, index) => {
          const distance =
            mark.showDistance && model.lastClose != null ? formatDistancePct(model.lastClose, mark.price) : null;
          const value = mark.priceHigh != null ? range(mark.price, mark.priceHigh) : money(mark.price);
          return (
            <li
              key={`${mark.kind}-${mark.price}-${index}`}
              className={`${styles.figureLabel} ${markClass(mark.kind)}`}
              style={{ top: `${(mark.displayY / model.height) * 100}%` }}
            >
              <span className={styles.markName}>{markName(mark)}</span>
              <span className={styles.markValue}>
                {value}
                {distance ? <span className={styles.markPct}> {distance}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function TechnicalAnalysisPanel({
  analysis,
  qualityScore,
}: {
  analysis: TechnicalAnalysis;
  /** Score qualité /100. null = N/D (titre non noté). */
  qualityScore: number | null;
}) {
  const { t, format, locale } = useI18n();
  const nd = t("common.nd");
  const tone = signalOf(analysis.signal.label).color;
  const currency: PriceCurrency = analysis.currency ?? "XOF";
  const lang = locale === "en" ? "en" : "fr";
  const money = (value: number) => formatPrice(value, currency, lang);
  const range = (low: number, high: number) => formatPriceRange(low, high, currency, lang);
  const price = (value: number | null | undefined) =>
    value == null ? nd : currency === "NGN" ? format.decimal(value, 2) : format.number(value);
  const structure = analysis.structure;
  const figures = useMemo(() => {
    return analysis.scenarios.map((scenario) => ({
      scenario,
      model: scenarioChartModel(
        analysis.chartBars,
        scenario,
        analysis.zones,
        t(`company.ta.scenario.${scenario.bias}`),
        analysis.gaps
      ),
    }));
  }, [analysis, t]);

  return (
    <section className={styles.panel} aria-labelledby="ta-title">
      <header className={styles.header}>
        <div>
          <h2 id="ta-title" className={styles.title}>
            {t("company.ta.title")}
          </h2>
          <p className={styles.lead}>{t("company.ta.lead")}</p>
        </div>
        <div className={styles.signalPill} style={{ borderColor: tone }}>
          <SignalBadge label={analysis.signal.label} />
          <span>
            {t("company.ta.confidence")} <ConfidenceDot value={analysis.signal.confidence} />
          </span>
        </div>
      </header>

      <p className={styles.note}>{t("company.ta.scoreVsTiming", { score: qualityScore == null ? nd : Math.round(qualityScore) })}</p>
      {analysis.liquidity.warningFr ? (
        <p className={styles.warning} role="status">
          {locale === "en" ? analysis.liquidity.warningEn : analysis.liquidity.warningFr}
        </p>
      ) : null}

      <div className={styles.stats}>
        <Stat label={t("company.ta.structure")} value={t(`company.ta.bias.${structure.bias}`)} />
        <Stat label={t("company.ta.swings")} value={structure.swingLabels.length ? structure.swingLabels.join(" · ") : nd} />
        <Stat label={t("company.ta.sma20")} value={price(structure.sma20)} />
        <Stat label={t("company.ta.sma50")} value={price(structure.sma50)} />
        <Stat label={t("company.ta.sma200")} value={price(structure.sma200)} />
        <Stat
          label={<EducationTermLink slug="rsi">{t("company.ta.rsi")}</EducationTermLink>}
          value={structure.rsi14 == null ? nd : format.decimal(structure.rsi14, 1)}
        />
        <Stat
          label={<EducationTermLink slug="macd">{t("company.ta.macd")}</EducationTermLink>}
          value={structure.macdHistogram == null ? nd : format.decimal(structure.macdHistogram, 2)}
        />
        <Stat label={t("company.ta.atr")} value={price(structure.atr14)} />
      </div>

      <div className={styles.split}>
        <div>
          <h3 className={styles.sub}>{t("company.ta.zonesTitle")}</h3>
          {analysis.zones.length === 0 ? (
            <p className={styles.empty}>{t("company.ta.zonesEmpty")}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("company.ta.col.kind")}</th>
                  <th scope="col">{t("company.ta.col.zone")}</th>
                  <th scope="col">{t("company.ta.col.touches")}</th>
                  <th scope="col">{t("company.ta.col.strength")}</th>
                  <th scope="col">{t("company.ta.col.reactions")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.zones.map((zone) => (
                  <tr key={zone.id}>
                    <td>{t(`company.ta.zone.${zone.kind}`)}</td>
                    <td>
                      {price(zone.low)} – {price(zone.high)}
                    </td>
                    <td>{zone.touches}</td>
                    <td>{zone.strength}/100</td>
                    <td>
                      {t("company.ta.reactions", { bounces: zone.bounces, breaks: zone.breaks })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className={styles.sub}>
            <abbr className={styles.tip} title={t("company.ta.fvgTip")}>
              {t("company.ta.gapsTitle")}
            </abbr>
          </h3>
          {analysis.gaps.length === 0 ? (
            <p className={styles.empty}>{t("company.ta.gapsEmpty")}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("company.ta.col.kind")}</th>
                  <th scope="col">{t("company.ta.col.zone")}</th>
                  <th scope="col">{t("company.ta.col.status")}</th>
                  <th scope="col">{t("company.ta.col.date")}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.gaps.map((gap) => (
                  <tr key={gap.id}>
                    <td>{t(gap.side === "bullish" ? "company.ta.gapBull" : "company.ta.gapBear")}</td>
                    <td>
                      {price(gap.low)} – {price(gap.high)}
                    </td>
                    <td>{t(`company.ta.gap.${gap.status}`)}</td>
                    <td>{format.date(gap.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <h3 className={styles.sub}>{t("company.ta.scenariosTitle")}</h3>
      <div className={styles.scenarios}>
        {figures.map(({ scenario, model }) => (
          <article key={scenario.id} className={styles.scenario}>
            <header className={styles.scenarioHead}>
              <h4>{t(`company.ta.scenario.${scenario.bias as ScenarioBias}`)}</h4>
              <span className={styles.probBadge}>{t("company.ta.probability", { value: scenario.probability })}</span>
            </header>
            <ScenarioFigure
              model={model}
              markerId={`ta-arrow-${scenario.bias}`}
              caption={t(`company.ta.scenario.${scenario.bias}`)}
              markName={(mark) => markLabel(mark, t)}
              money={money}
              range={range}
            />
            <ScenarioCopy
              scenario={scenario}
              last={structure.lastClose}
              locale={lang}
              nd={nd}
              t={t}
              money={money}
              range={range}
            />
          </article>
        ))}
      </div>
      <p className={styles.disclaimer}>{t("company.ta.disclaimer")}</p>
    </section>
  );
}

function markLabel(mark: ScenarioChartMark, t: TFunc): string {
  if (mark.kind === "target") return t("company.ta.chart.target", { n: mark.targetIndex ?? 1 });
  if (mark.kind === "stop") return t("company.ta.chart.invalidation");
  if (mark.kind === "entry") return t("company.ta.chart.entry");
  if (mark.kind === "last") return t("company.ta.chart.last");
  if (mark.kind === "support") return t("company.ta.zone.support");
  if (mark.kind === "resistance") return t("company.ta.zone.resistance");
  return t("company.ta.chart.fvg");
}

function ScenarioCopy({
  scenario,
  last,
  locale,
  nd,
  t,
  money,
  range,
}: {
  scenario: ScenarioPlan;
  last: number | null;
  locale: "fr" | "en";
  nd: string;
  t: TFunc;
  money: (value: number) => string;
  range: (low: number, high: number) => string;
}) {
  const distance = (level: number | null) => (level == null || last == null ? null : formatDistancePct(last, level));
  const entry =
    scenario.entryLow == null || scenario.entryHigh == null ? nd : range(scenario.entryLow, scenario.entryHigh);
  return (
    <div className={styles.copy}>
      <h5>{t("company.ta.sections.scenario")}</h5>
      <p>{locale === "en" ? scenario.headlineEn : scenario.headlineFr}</p>
      <h5>{t("company.ta.sections.why")}</h5>
      <p>{locale === "en" ? scenario.explanationEn : scenario.explanationFr}</p>
      <h5>{t("company.ta.sections.plan")}</h5>
      <div className={styles.chips}>
        <span className={`${styles.chip} ${styles.chipLast}`}>
          {t("company.ta.chart.last")} {last == null ? nd : money(last)}
        </span>
        <span className={`${styles.chip} ${styles.chipEntry}`}>
          {t("company.ta.chart.entry")} {entry}
        </span>
        {scenario.targets.map((target, index) => (
          <span key={`${target}-${index}`} className={`${styles.chip} ${styles.chipTarget}`}>
            {t("company.ta.chart.target", { n: index + 1 })} {money(target)}
            {distance(target) ? ` ${distance(target)}` : ""}
          </span>
        ))}
        <span className={`${styles.chip} ${styles.chipStop}`}>
          {t("company.ta.chart.invalidation")}{" "}
          {scenario.invalidation == null ? nd : money(scenario.invalidation)}
          {distance(scenario.invalidation) ? ` ${distance(scenario.invalidation)}` : ""}
        </span>
      </div>
      <h5>{t("company.ta.sections.reward")}</h5>
      <p>{rewardRiskSentence(scenario.riskReward, locale)}</p>
    </div>
  );
}

function Stat({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
