"use client";

// Panneau d'analyse technique sous le graphe de la fiche (zones, FVG, scénarios).
// Les chiffres viennent de `analyzePriceHistory` — rien n'est inventé.

import SignalBadge from "@/components/ui/SignalBadge";
import ConfidenceDot from "@/components/ui/ConfidenceDot";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signalOf } from "@/lib/calc/calc-metrics";
import EducationTermLink from "@/components/education/EducationTermLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import {
  formatDistancePct,
  formatPrice,
  formatPriceNumber,
  formatPriceRange,
  rewardRiskSentence,
  type PriceCurrency,
} from "@/lib/technical-analysis/level-label";
import { mostProbableScenarioIndex, SCENARIO_CHART, scenarioChartModel } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioChartMark } from "@/lib/technical-analysis/scenario-chart";
import type { ScenarioBias, ScenarioPlan, TechnicalAnalysis } from "@/lib/technical-analysis/types";
import LevelLegend, { type LevelLegendItem } from "@/components/charts/LevelLegend";
import styles from "./TechnicalAnalysisPanel.module.css";

function tagClass(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "resistance") return styles.tagTarget;
  if (kind === "stop" || kind === "support") return styles.tagStop;
  if (kind === "entry" || kind === "fvg") return styles.tagEntry;
  return styles.tagLast;
}

function legendColor(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "resistance") return "var(--c-green)";
  if (kind === "stop" || kind === "support") return "var(--c-red)";
  if (kind === "entry" || kind === "fvg") return "var(--c-blue)";
  return "var(--c-text)";
}

function lineClass(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "resistance") return styles.targetLine;
  if (kind === "stop" || kind === "support") return styles.stopLine;
  if (kind === "entry" || kind === "fvg") return styles.entryLine;
  return styles.lastLine;
}

function leaderClass(kind: ScenarioChartMark["kind"]): string {
  if (kind === "target" || kind === "resistance") return styles.leaderTarget;
  if (kind === "stop" || kind === "support") return styles.leaderStop;
  if (kind === "entry" || kind === "fvg") return styles.leaderEntry;
  return styles.leaderLast;
}

/** Largeur approximative d'un texte 10,5 px gras (chiffres tabulaires). */
function textWidth(text: string): number {
  return text.length * 6.1;
}

const TAG_PAD = 5;
const TAG_SPACE = 5;

export type ScenarioFigureInput = {
  bars: TechnicalAnalysis["chartBars"];
  scenario: ScenarioPlan;
  zones: TechnicalAnalysis["zones"];
  gaps: TechnicalAnalysis["gaps"];
  title: string;
};

export function ScenarioFigure({
  input,
  caption,
  shortName,
  fvgLabel,
  futureLabel,
  unitLabel,
  value,
  range,
  height = SCENARIO_CHART.height,
}: {
  input: ScenarioFigureInput;
  caption: string;
  /** Nom court du niveau, dans l'étiquette (Obj. 1, Invalid., Entrée…). */
  shortName: (mark: ScenarioChartMark) => string;
  fvgLabel: string;
  futureLabel: string;
  /** Unité affichée en bas de la zone de projection (FCFA). Vide si déjà dans les prix (₦). */
  unitLabel: string;
  /** Prix sans unité FCFA (ou avec ₦). */
  value: (price: number) => string;
  range: (low: number, high: number) => string;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(SCENARIO_CHART.width);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const next = Math.round(wrap.clientWidth);
      if (next > 0) setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const model = useMemo(() => {
    // Première passe pour connaître les niveaux, puis largeur d'axe ajustée aux étiquettes.
    const draft = scenarioChartModel(input.bars, input.scenario, input.zones, input.title, input.gaps, { width, height });
    const widest = draft.marks.reduce((acc, mark) => {
      const text = mark.priceHigh != null ? "" : value(mark.price);
      return Math.max(acc, textWidth(shortName(mark)) + (text ? TAG_SPACE + textWidth(text) : 0));
    }, 40);
    const gutter = Math.ceil(widest + TAG_PAD * 2 + SCENARIO_CHART.leaderBend + 4);
    return scenarioChartModel(input.bars, input.scenario, input.zones, input.title, input.gaps, { width, height, gutter });
  }, [input, width, height, range, value, shortName]);

  const tagX = model.plotRight + SCENARIO_CHART.leaderBend + 2;
  const tagW = model.width - tagX - 1;
  const tagH = model.tagHeight;
  const gradientId = `ta-area-${input.scenario.id}`;
  const arrowClass =
    model.arrow?.direction === "up" ? styles.arrowUp : model.arrow?.direction === "down" ? styles.arrowDown : styles.arrowFlat;
  // Ordre de dessin : le cours en dernier, au-dessus des autres étiquettes.
  const order = model.marks.map((_, index) => index).sort((a, b) => Number(model.marks[a]!.kind === "last") - Number(model.marks[b]!.kind === "last"));

  return (
    <div ref={wrapRef} className={styles.figureWrap}>
      <svg
        className={styles.figure}
        width={model.width}
        height={model.height}
        viewBox={`0 0 ${model.width} ${model.height}`}
        role="img"
        aria-label={caption}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.areaStopTop} />
            <stop offset="100%" className={styles.areaStopBottom} />
          </linearGradient>
        </defs>
        <rect width={model.width} height={model.height} className={styles.figureBg} rx="8" />
        <rect
          x={model.lastX}
          y={0}
          width={Math.max(0, model.plotRight - model.lastX)}
          height={model.height}
          className={styles.futureZone}
        />
        <line x1={model.plotRight} x2={model.plotRight} y1={0} y2={model.height} className={styles.axisLine} />
        <text x={model.lastX + 5} y={12} className={styles.futureLabel}>
          {futureLabel}
        </text>
        {unitLabel ? (
          <text x={model.plotRight - 4} y={model.height - 5} textAnchor="end" className={styles.unitLabel}>
            {unitLabel}
          </text>
        ) : null}
        {model.zones.map((zone, index) => (
          <rect
            key={`${zone.kind}-${index}`}
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            className={zone.kind === "gap" ? styles.zoneGap : styles.zoneEntry}
          />
        ))}
        {model.area ? <path d={model.area} fill={`url(#${gradientId})`} /> : null}
        <polyline points={model.polyline} className={styles.priceLine} />
        {model.marks.map((mark, index) => (
          <line
            key={`line-${mark.kind}-${mark.price}-${index}`}
            x1={model.plotLeft}
            x2={model.plotRight}
            y1={mark.y}
            y2={mark.y}
            className={lineClass(mark.kind)}
          />
        ))}
        {model.tags.map((tag, index) => (
          <g key={`${tag.kind}-${index}`} className={styles.fvgTag}>
            <rect x={tag.x} y={tag.y - 8} width="30" height="16" rx="3" />
            <text x={tag.x + 15} y={tag.y + 3.5} textAnchor="middle">
              {fvgLabel}
            </text>
          </g>
        ))}
        {model.arrow ? (
          <g className={arrowClass}>
            <circle cx={model.lastX} cy={model.arrow.y1} r={3.2} className={styles.lastDot} />
            <line x1={model.arrow.x1} y1={model.arrow.y1} x2={model.arrow.x2} y2={model.arrow.y2} className={styles.arrow} />
            <polygon points={model.arrow.head} className={styles.arrowHead} />
          </g>
        ) : null}
        {model.leaders.map((leader, index) =>
          Math.abs(leader.y1 - leader.y3) < 0.5 ? (
            <line
              key={`leader-${index}`}
              x1={leader.x1}
              y1={leader.y1}
              x2={tagX}
              y2={leader.y3}
              className={`${styles.leader} ${leaderClass(leader.kind)}`}
            />
          ) : (
            <path
              key={`leader-${index}`}
              d={`M${leader.x1},${leader.y1} L${leader.x2},${leader.y3} L${tagX},${leader.y3}`}
              className={`${styles.leader} ${leaderClass(leader.kind)}`}
            />
          )
        )}
        {order.map((index) => {
          const mark = model.marks[index]!;
          // Repère discret : code + prix. Fourchette d'entrée : code seul (détail dans la légende).
          const text = mark.priceHigh != null ? "" : value(mark.price);
          const top = mark.displayY - tagH / 2;
          return (
            <g key={`tag-${mark.kind}-${mark.price}-${index}`} className={`${styles.priceTag} ${tagClass(mark.kind)}`}>
              <rect x={tagX} y={top} width={tagW} height={tagH} rx={4} />
              <text x={tagX + TAG_PAD} y={mark.displayY + 3.8} className={styles.tagName}>
                {shortName(mark)}
              </text>
              <text x={tagX + tagW - TAG_PAD} y={mark.displayY + 3.8} textAnchor="end" className={styles.tagValue}>
                {text}
              </text>
            </g>
          );
        })}
      </svg>
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
  const topIndex = mostProbableScenarioIndex(analysis.scenarios, structure.bias);
  const figures = useMemo(() => {
    const list = analysis.scenarios.map((scenario, index) => ({
      scenario,
      top: index === topIndex,
      marks: scenarioChartModel(analysis.chartBars, scenario, analysis.zones, "", analysis.gaps).marks,
      input: {
        bars: analysis.chartBars,
        scenario,
        zones: analysis.zones,
        gaps: analysis.gaps,
        title: t(`company.ta.scenario.${scenario.bias}`),
      } satisfies ScenarioFigureInput,
    }));
    // Le plus probable en premier, les autres gardent leur ordre.
    return [...list.filter((item) => item.top), ...list.filter((item) => !item.top)];
  }, [analysis, t, topIndex]);
  const tagValue = useCallback(
    (value: number) => (currency === "NGN" ? formatPrice(value, currency, lang) : formatPriceNumber(value, currency, lang)),
    [currency, lang]
  );
  const tagRange = useCallback(
    (low: number, high: number) => {
      const a = Math.min(low, high);
      const b = Math.max(low, high);
      return `${tagValue(a)}–${currency === "NGN" ? formatPriceNumber(b, currency, lang) : tagValue(b)}`;
    },
    [currency, lang, tagValue]
  );
  const shortName = useCallback((mark: ScenarioChartMark) => markShortLabel(mark, t), [t]);
  const legendItems = (marks: ScenarioChartMark[]): LevelLegendItem[] =>
    [...marks]
      .sort((a, b) => (b.priceHigh ?? b.price) - (a.priceHigh ?? a.price))
      .map((mark, index) => ({
        key: `${mark.kind}-${index}`,
        short: markShortLabel(mark, t),
        color: legendColor(mark.kind),
        name: markLabel(mark, t),
        value: mark.priceHigh != null ? range(mark.price, mark.priceHigh) : money(mark.price),
        distance: mark.showDistance && structure.lastClose != null ? formatDistancePct(structure.lastClose, mark.price) : null,
        distanceTone: mark.kind === "stop" ? ("bad" as const) : ("good" as const),
      }));

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
        {figures.map(({ scenario, input, top, marks }) => (
          <article
            key={scenario.id}
            className={`${styles.scenario} ${top ? styles.scenarioTop : styles.scenarioMuted}`}
            aria-label={top ? t("company.ta.mostProbable") : undefined}
          >
            {top ? <span className={styles.topBadge}>★ {t("company.ta.mostProbable")}</span> : null}
            <header className={styles.scenarioHead}>
              <h4 className={styles[`bias_${scenario.bias}`]}>{t(`company.ta.scenario.${scenario.bias as ScenarioBias}`)}</h4>
              <span className={styles.probBadge}>{t("company.ta.probability", { value: scenario.probability })}</span>
            </header>
            <ScenarioFigure
              input={input}
              caption={t(`company.ta.scenario.${scenario.bias}`)}
              shortName={shortName}
              fvgLabel={t("company.ta.chart.fvg")}
              futureLabel={t("company.ta.chart.projection")}
              unitLabel={currency === "NGN" ? "" : "FCFA"}
              value={tagValue}
              range={tagRange}
              height={top ? 280 : SCENARIO_CHART.height}
            />
            <div className={styles.below}>
              <ScenarioCopy scenario={scenario} locale={lang} t={t} />
              <LevelLegend title={t("company.ta.levelsLegend")} items={legendItems(marks)} className={styles.belowLegend} />
            </div>
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
  if (mark.kind === "entry") return t("company.ta.entry");
  if (mark.kind === "last") return t("company.ta.chart.last");
  if (mark.kind === "support") return t("company.ta.zone.support");
  if (mark.kind === "resistance") return t("company.ta.zone.resistance");
  return t("company.ta.chart.fvg");
}

function markShortLabel(mark: ScenarioChartMark, t: TFunc): string {
  if (mark.kind === "target") return t("company.ta.chart.targetShort", { n: mark.targetIndex ?? 1 });
  if (mark.kind === "stop") return t("company.ta.chart.invalidationShort");
  if (mark.kind === "entry") return t("company.ta.chart.entryShort");
  if (mark.kind === "last") return t("company.ta.chart.lastShort");
  if (mark.kind === "support") return t("company.ta.chart.supportShort");
  if (mark.kind === "resistance") return t("company.ta.chart.resistanceShort");
  return t("company.ta.chart.fvg");
}

function ScenarioCopy({ scenario, locale, t }: { scenario: ScenarioPlan; locale: "fr" | "en"; t: TFunc }) {
  return (
    <div className={styles.copy}>
      <h5>{t("company.ta.sections.scenario")}</h5>
      <p>{locale === "en" ? scenario.headlineEn : scenario.headlineFr}</p>
      <h5>{t("company.ta.sections.why")}</h5>
      <p>{locale === "en" ? scenario.explanationEn : scenario.explanationFr}</p>
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
