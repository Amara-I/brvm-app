"use client";

// Panneau d'analyse technique sous le graphe de la fiche (zones, FVG, scénarios).
// Les chiffres viennent de `analyzePriceHistory` — rien n'est inventé.

import { useMemo } from "react";
import { signalOf } from "@/lib/calc/calc-metrics";
import { useI18n } from "@/components/i18n/I18nProvider";
import { scenarioChartModel } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioChartModel } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioBias, TechnicalAnalysis } from "@/lib/technical-analysis/types";
import styles from "./TechnicalAnalysisPanel.module.css";

function ScenarioFigure({ model, caption, markerId }: { model: ScenarioChartModel; caption: string; markerId: string }) {
  return (
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
            zone.kind === "support" ? styles.zoneSupport : zone.kind === "resistance" ? styles.zoneResistance : styles.zoneEntry
          }
        />
      ))}
      <polyline points={model.polyline} className={styles.priceLine} />
      {model.marks.map((mark) => (
        <g key={`${mark.kind}-${mark.label}-${mark.y}`}>
          <line
            x1={16}
            x2={model.width - 108}
            y1={mark.y}
            y2={mark.y}
            className={mark.kind === "stop" ? styles.stopLine : mark.kind === "target" ? styles.targetLine : styles.lastLine}
          />
          <text x={model.width - 12} y={mark.y + 4} className={styles.markLabel} textAnchor="end">
            {mark.label}
          </text>
        </g>
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
  );
}

export default function TechnicalAnalysisPanel({
  analysis,
  qualityScore,
}: {
  analysis: TechnicalAnalysis;
  qualityScore: number;
}) {
  const { t, format, labels, locale } = useI18n();
  const nd = t("common.nd");
  const tone = signalOf(analysis.signal.label).color;
  const price = (value: number | null | undefined) => (value == null ? nd : format.number(value));
  const structure = analysis.structure;
  const figures = useMemo(() => {
    return analysis.scenarios.map((scenario) => ({
      scenario,
      model: scenarioChartModel(
        analysis.chartBars,
        scenario,
        analysis.zones,
        t(`company.ta.scenario.${scenario.bias}`)
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
          <strong style={{ color: tone }}>{labels.signal(analysis.signal.label)}</strong>
          <span>
            {t("company.ta.confidence")} {labels.confidence(analysis.signal.confidence)}
          </span>
        </div>
      </header>

      <p className={styles.note}>{t("company.ta.scoreVsTiming", { score: qualityScore })}</p>
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
        <Stat label={t("company.ta.rsi")} value={structure.rsi14 == null ? nd : format.decimal(structure.rsi14, 1)} />
        <Stat
          label={t("company.ta.macd")}
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
          <h3 className={styles.sub}>{t("company.ta.gapsTitle")}</h3>
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
              <span>{t("company.ta.probability", { value: scenario.probability })}</span>
            </header>
            <ScenarioFigure
              model={model}
              markerId={`ta-arrow-${scenario.bias}`}
              caption={t(`company.ta.scenario.${scenario.bias}`)}
            />
            <p className={styles.explanation}>
              {locale === "en" ? scenario.explanationEn : scenario.explanationFr}
            </p>
            <dl className={styles.levels}>
              <div>
                <dt>{t("company.ta.entry")}</dt>
                <dd>
                  {scenario.entryLow == null || scenario.entryHigh == null
                    ? nd
                    : `${price(scenario.entryLow)} – ${price(scenario.entryHigh)}`}
                </dd>
              </div>
              <div>
                <dt>{t("company.ta.invalidation")}</dt>
                <dd>{price(scenario.invalidation)}</dd>
              </div>
              <div>
                <dt>{t("company.ta.targets")}</dt>
                <dd>{scenario.targets.length ? scenario.targets.map((target) => price(target)).join(" · ") : nd}</dd>
              </div>
              <div>
                <dt>{t("company.ta.rr")}</dt>
                <dd>{scenario.riskReward == null ? nd : format.decimal(scenario.riskReward, 1)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className={styles.disclaimer}>{t("company.ta.disclaimer")}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
