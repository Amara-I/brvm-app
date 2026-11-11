"use client";

// Onglet Analyse fondamentale, partagé par les fiches BRVM et NGX : mêmes 8 étapes,
// montants dans la devise de la place (FCFA ou ₦). Le score de Vue d'ensemble n'est pas recalculé.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { FormatApi } from "@/lib/i18n/format";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
import { outlookSummary, outlookText, type OutlookItemType } from "@/lib/outlook/synthesis";
import {
  analysisFromSheet,
  type BrvmFundamentalAnalysis,
  type BrvmSheetSlice,
  type FundamentalMarket,
  type FundamentalStep,
  type FundamentalStepId,
} from "@/lib/fundamental/brvm-analysis";
import type { PricePoint } from "@/lib/ngx/price-stats";
import { outlookHeadline } from "@/lib/fundamental/outlook-headline";
import {
  PER_NOT_SIGNIFICANT_ABOVE,
  YIELD_NOT_SIGNIFICANT_ABOVE,
  type BrvmValueMethod,
  type MethodSkipReason,
} from "@/lib/fundamental/valuation-methods";
import type { PolicyCriterion } from "@/lib/ngx/policy";
import { VALUATION_BAND_PERCENT } from "@/lib/ngx/valuation";
import { getPortfolioTypeDef, PORTFOLIO_TYPE_THEME_SLUG } from "@/lib/portfolio-types";
import type { PortfolioTypeId } from "@/lib/portfolio-types/constants";
import styles from "./FundamentalAnalysis.module.css";

function ChartLoading() {
  const { t } = useI18n();
  return (
    <p className={styles.note} role="status">
      {t("company.fundamental.chartLoading")}
    </p>
  );
}

const FundamentalCharts = dynamic(() => import("./FundamentalCharts"), {
  ssr: false,
  loading: () => <ChartLoading />,
});

const OUTLOOK_TYPES: OutlookItemType[] = ["guidance", "project", "analyst", "risk", "sector"];

function methodLabel(t: TFunc, method: BrvmValueMethod): string {
  if (method === "DIVIDEND_YIELD" || method === "DDM" || method === "HISTORICAL_PE") {
    return t(`company.fundamental.methods.${method}`);
  }
  return t(`ngx.sheet.valuation.methods.${method}`);
}

function skipLabel(t: TFunc, reason: MethodSkipReason): string {
  return t(`company.fundamental.skip.${reason}`);
}

const CEILING = new Set<PolicyCriterion["key"]>(["payout", "drawdown", "volatility"]);
const INTEGER = new Set<PolicyCriterion["key"]>(["dividendRegularity"]);
const NO_VALUE = new Set<PolicyCriterion["key"]>(["valuation", "trend"]);

function stepVerdict(t: TFunc, step: FundamentalStep): string {
  switch (step.id) {
    case "presentation":
      if (step.verdict === "complete" || step.verdict === "partial" || step.verdict === "missing")
        return t(`company.fundamental.verdict.presentation.${step.verdict}`);
      break;
    case "performance":
      if (
        step.verdict === "growing" ||
        step.verdict === "mixed" ||
        step.verdict === "declining" ||
        step.verdict === "loss" ||
        step.verdict === "stale" ||
        step.verdict === "missing"
      )
        return t(`company.fundamental.verdict.performance.${step.verdict}`);
      break;
    case "outlook":
      if (step.verdict === "available" || step.verdict === "missing")
        return t(`company.fundamental.verdict.outlook.${step.verdict}`);
      break;
    case "price":
      if (
        step.verdict === "liquid" ||
        step.verdict === "thin" ||
        step.verdict === "illiquid" ||
        step.verdict === "unrated" ||
        step.verdict === "missing"
      )
        return t(`company.fundamental.verdict.price.${step.verdict}`);
      break;
    case "valuation":
      if (step.verdict === "BELOW" || step.verdict === "WITHIN" || step.verdict === "ABOVE" || step.verdict === "UNKNOWN")
        return t(`ngx.sheet.valuation.verdict.${step.verdict}`);
      break;
    case "sector":
      if (step.verdict === "comparable" || step.verdict === "cautious" || step.verdict === "missing")
        return t(`company.fundamental.verdict.sector.${step.verdict}`);
      break;
    case "dividends":
      if (step.verdict === "sustainable" || step.verdict === "partial" || step.verdict === "payout" || step.verdict === "missing")
        return t(`company.fundamental.verdict.dividends.${step.verdict}`);
      break;
    case "conclusion":
      if (step.verdict === "adapted" || step.verdict === "mixed" || step.verdict === "unfavorable" || step.verdict === "insufficient")
        return t(`company.fundamental.verdict.conclusion.${step.verdict}`);
      break;
  }
  return t("common.nd");
}

/** Textes dont la version NGX parle de nairas (et non de FCFA) ou de la source NGX. */
const NGX_COPY = new Set([
  "intro",
  "noEquity",
  "accountsNote",
  "ratiosNote",
  "dividendNote",
  "outlookEmpty",
  "illiquidLowValue",
] as const);
type MarketCopyKey = typeof NGX_COPY extends Set<infer K> ? K : never;

function marketCopy(t: TFunc, market: FundamentalMarket, key: MarketCopyKey, vars?: Record<string, string | number>): string {
  return market === "NGX" ? t(`company.fundamental.ngx.${key}`, vars) : t(`company.fundamental.${key}`, vars);
}

/** Lien vers la fiche d'un pair, selon la place. */
export function peerSheetHref(market: FundamentalMarket, ticker: string): string {
  const safe = encodeURIComponent(ticker);
  return market === "NGX" ? `/marches/ngx/actions/${safe}` : `/actions/${safe}`;
}

export default function FundamentalAnalysisPanel({
  slice,
  close,
  preferredPortfolioType,
}: {
  slice: BrvmSheetSlice;
  close: number | null;
  /** Préférence de profil. null = visiteur non connecté ou préférence non enregistrée. */
  preferredPortfolioType: PortfolioTypeId | null;
}) {
  const today = slice.sessionDate && /^\d{4}-\d{2}-\d{2}/.test(slice.sessionDate)
    ? slice.sessionDate.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const model = useMemo(() => analysisFromSheet(slice, close, today), [slice, close, today]);
  return (
    <FundamentalAnalysisBody
      model={model}
      series={slice.series}
      yearPrices={slice.company.prices}
      market="BRVM"
      preferredPortfolioType={preferredPortfolioType}
    />
  );
}

/**
 * Corps de l'onglet à partir d'une analyse déjà construite.
 * NGX : l'analyse est calculée côté serveur (lib/fundamental/ngx-adapter.ts).
 */
export function FundamentalAnalysisBody({
  model,
  series,
  yearPrices,
  market,
  preferredPortfolioType,
}: {
  model: BrvmFundamentalAnalysis;
  series: readonly PricePoint[];
  /** Dernière clôture de chaque année : rendement historique du graphique des dividendes. */
  yearPrices: Record<number, number>;
  market: FundamentalMarket;
  preferredPortfolioType: PortfolioTypeId | null;
}) {
  const { t, format, locale } = useI18n();
  const [open, setOpen] = useState<Partial<Record<FundamentalStepId, boolean>>>({});
  const nd = t("common.nd");
  const bnUnit = market === "NGX" ? t("ngx.sheet.unitBn") : t("company.fundamental.field.bnUnit");
  const bn = (v: number | null) => (v == null ? nd : `${format.decimal(v, Math.abs(v) >= 100 ? 0 : 1)} ${bnUnit}`);
  const fcfa = (v: number | null) => (v == null ? nd : market === "NGX" ? format.money(v, "NGN") : format.fcfa(v));
  const pct = (v: number | null, digits = 1, sign = false) => (v == null ? nd : format.percent(v, digits, sign));
  const mult = (v: number | null) => (v == null ? nd : `${format.decimal(v, 1)}×`);
  const day = (iso: string | null) =>
    iso && /^\d{4}-\d{2}-\d{2}/.test(iso)
      ? format.date(`${iso.slice(0, 10)}T12:00:00.000Z`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : nd;

  const multiple = (status: string, value: number | null, asMult = true) => {
    if (status === "stale" || status === "outlier") return t("company.fundamental.notSignificant");
    if (status === "negative") return t("company.fundamental.negativeMultiple");
    return asMult ? mult(value) : pct(value, 1);
  };

  function figuresFor(step: FundamentalStep): string {
    const { presentation: p, performance: perf, price, dividends: d, sector, valuation } = model;
    switch (step.id) {
      case "presentation":
        return [p.sector || nd, bn(p.marketCapBn)].join(" · ");
      case "performance":
        return `${t("company.fundamental.field.revenueCagr")} ${pct(perf.revenueCagr.cagr, 1, true)}`;
      case "outlook":
        return outlookHeadline(model.outlook.synthesis, locale) ?? nd;
      case "price": {
        const band =
          model.liquidity.stats.low52 != null && model.liquidity.stats.high52 != null
            ? `${fcfa(model.liquidity.stats.low52)} – ${fcfa(model.liquidity.stats.high52)}`
            : null;
        return [
          `${t("company.fundamental.field.per")} ${multiple(price.per.status, price.per.value)}`,
          `${t("company.fundamental.field.yield")} ${pct(price.yieldPercent, 2)}`,
          band,
        ]
          .filter(Boolean)
          .join(" · ");
      }
      case "valuation":
        if (valuation.rangeMode === "none") return t("company.fundamental.notSignificant");
        if (valuation.rangeMode === "single") return fcfa(valuation.summary.mid);
        return valuation.summary.gapToMidPercent == null ? nd : pct(valuation.summary.gapToMidPercent, 0, true);
      case "sector": {
        const perRow = sector.rows.find((r) => r.key === "per");
        const position = perRow?.position ? t(`company.fundamental.position.${perRow.position}`) : null;
        return [t("company.fundamental.field.peers", { count: sector.peersWithData }), position].filter(Boolean).join(" · ");
      }
      case "dividends":
        return `${t("company.fundamental.field.yield")} ${pct(d.currentYieldPercent, 2)}`;
      case "conclusion": {
        const names = (ids: PortfolioTypeId[]) =>
          ids.map((id) => localizedTypeDef(getPortfolioTypeDef(id), locale).label).join(", ");
        if (model.adapted.length > 0) return names(model.adapted);
        if (model.partial.length > 0) return names(model.partial);
        return stepVerdict(t, step);
      }
    }
  }

  function toggle(id: FundamentalStepId) {
    setOpen((curr) => ({ ...curr, [id]: !curr[id] }));
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{marketCopy(t, market, "intro")}</p>
      {model.steps.map((step, index) => {
        const expanded = open[step.id] === true;
        const title = t(`ngx.sheet.sections.${step.id}`);
        const buttonId = `fundamental-${step.id}-button`;
        const panelId = `fundamental-${step.id}-panel`;
        return (
          <section key={step.id} className={styles.step} data-fundamental-step={step.id}>
            <h3 className={styles.stepHeading}>
              <button
                type="button"
                id={buttonId}
                className={styles.stepButton}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(step.id)}
              >
                <span className={styles.num}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.title}>{title}</span>
                <span className={`${styles.badge} ${styles[step.tone]}`}>{stepVerdict(t, step)}</span>
                <span className={styles.figures}>{figuresFor(step)}</span>
                <span className={styles.chevron} aria-hidden="true">
                  {expanded ? "▴" : "▾"}
                </span>
                <span className={styles.srOnly}>
                  {expanded ? t("company.fundamental.hideDetail", { step: title }) : t("company.fundamental.showDetail", { step: title })}
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded} className={styles.panel}>
              {expanded && step.id === "presentation" && (
                <Presentation model={model} t={t} format={format} nd={nd} bn={bn} day={day} pct={pct} />
              )}
              {expanded && step.id === "performance" && (
                <>
                  <Performance model={model} t={t} nd={nd} bn={bn} pct={pct} fcfa={fcfa} market={market} />
                  <FundamentalCharts kind="performance" years={model.performance.years} market={market} />
                </>
              )}
              {expanded && step.id === "outlook" && <Outlook model={model} t={t} locale={locale} pct={pct} market={market} />}
              {expanded && step.id === "price" && (
                <>
                  <Price
                    model={model}
                    t={t}
                    format={format}
                    nd={nd}
                    bn={bn}
                    fcfa={fcfa}
                    pct={pct}
                    multiple={multiple}
                    market={market}
                  />
                  <FundamentalCharts
                    kind="price"
                    market={market}
                    points={series}
                    high52={model.liquidity.stats.high52}
                    low52={model.liquidity.stats.low52}
                  />
                </>
              )}
              {expanded && step.id === "valuation" && (
                <>
                  <Valuation model={model} t={t} format={format} nd={nd} fcfa={fcfa} pct={pct} />
                  <FundamentalCharts
                    kind="valuation"
                    market={market}
                    price={model.price.close}
                    low={model.valuation.summary.low}
                    high={model.valuation.summary.high}
                    single={model.valuation.rangeMode === "single"}
                    methods={model.valuation.estimates.map((e) => ({ label: methodLabel(t, e.method), value: e.value }))}
                  />
                </>
              )}
              {expanded && step.id === "sector" && (
                <>
                  <Sector model={model} t={t} format={format} nd={nd} pct={pct} mult={mult} market={market} />
                  <FundamentalCharts
                    kind="sector"
                    market={market}
                    bars={model.sector.rows
                      .filter((r) => r.company != null && r.stat.median != null && r.stat.median !== 0)
                      .map((r) => ({
                        label:
                          r.key === "revenueGrowth"
                            ? t("company.fundamental.field.revenueYoy")
                            : t(`ngx.sheet.sector.metrics.${r.key as "per" | "pbr" | "yield" | "netMargin" | "roe"}`),
                        index: (r.company! / r.stat.median!) * 100,
                      }))}
                  />
                </>
              )}
              {expanded && step.id === "dividends" && (
                <>
                  <Dividends model={model} t={t} format={format} nd={nd} fcfa={fcfa} pct={pct} day={day} market={market} />
                  <FundamentalCharts
                    kind="dividends"
                    market={market}
                    points={[...model.dividends.lines].reverse().map((line) => {
                      const yearPrice = yearPrices[line.year];
                      const yieldPercent =
                        yearPrice != null && yearPrice > 0 && line.dps >= 0 && (line.dps / yearPrice) * 100 <= YIELD_NOT_SIGNIFICANT_ABOVE
                          ? (line.dps / yearPrice) * 100
                          : null;
                      return { year: String(line.year), dps: line.dps, yieldPercent };
                    })}
                  />
                </>
              )}
              {expanded && step.id === "conclusion" && (
                <>
                  <FundamentalCharts
                    kind="conclusion"
                    market={market}
                    bars={model.policies
                      .filter((p) => p.evaluated > 0)
                      .map((p) => ({
                        label: localizedTypeDef(getPortfolioTypeDef(p.type), locale).label,
                        share: (p.okCount / p.evaluated) * 100,
                      }))}
                  />
                  <Conclusion
                    model={model}
                    t={t}
                    format={format}
                    locale={locale}
                    nd={nd}
                    fcfa={fcfa}
                    pct={pct}
                    market={market}
                    preferredPortfolioType={preferredPortfolioType}
                  />
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type Model = BrvmFundamentalAnalysis;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function Illiquid({ model, t, format, market }: { model: Model; t: TFunc; format: FormatApi; market: FundamentalMarket }) {
  if (!model.liquidity.illiquid) return null;
  const ratio = model.liquidity.tradedSessionsRatio;
  return (
    <div className={styles.alert} role="status">
      <strong>{t("company.fundamental.illiquidTitle")}</strong>
      {t("company.fundamental.illiquidBody")}
      <ul>
        {model.liquidity.reasons.includes("noTrade") && ratio != null ? (
          <li>{t("company.fundamental.illiquidNoTrade", { pct: format.percent((1 - ratio) * 100, 0) })}</li>
        ) : null}
        {model.liquidity.reasons.includes("lowVolume") && model.liquidity.avgShareVolume != null ? (
          <li>{t("company.fundamental.illiquidLowVolume", { volume: format.integer(model.liquidity.avgShareVolume) })}</li>
        ) : null}
        {model.liquidity.reasons.includes("lowValue") && model.liquidity.avgDailyValueFcfa != null ? (
          <li>{marketCopy(t, market, "illiquidLowValue", { value: format.integer(model.liquidity.avgDailyValueFcfa) })}</li>
        ) : null}
      </ul>
    </div>
  );
}

function Presentation({
  model,
  t,
  format,
  nd,
  bn,
  day,
  pct,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  nd: string;
  bn: (v: number | null) => string;
  day: (iso: string | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
}) {
  const p = model.presentation;
  return (
    <>
      {p.description ? <p className={styles.bodyText}>{p.description}</p> : <p className={styles.note}>{nd}</p>}
      <div className={styles.grid}>
        <Stat label={t("company.fundamental.field.sector")} value={p.sector || nd} />
        <Stat label={t("company.fundamental.field.industry")} value={p.industry || nd} />
        <Stat label={t("company.fundamental.field.country")} value={p.country || nd} />
        <Stat label={t("company.fundamental.field.isin")} value={p.isin || nd} />
        <Stat label={t("company.fundamental.field.listed")} value={day(p.listedSince)} />
        <Stat label={t("company.fundamental.field.shares")} value={p.shares == null ? nd : format.integer(p.shares)} />
        <Stat label={t("company.fundamental.field.float")} value={pct(p.floatPercent, 2)} />
        <Stat label={t("company.fundamental.field.cap")} value={bn(p.marketCapBn)} />
        <Stat
          label={t("company.fundamental.field.rank")}
          value={
            p.marketCapRank == null
              ? nd
              : t("company.fundamental.field.rankValue", { rank: p.marketCapRank, count: p.rankedCount })
          }
        />
      </div>
    </>
  );
}

function Performance({
  model,
  t,
  nd,
  bn,
  pct,
  fcfa,
  market,
}: {
  model: Model;
  t: TFunc;
  nd: string;
  bn: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  fcfa: (v: number | null) => string;
  market: FundamentalMarket;
}) {
  const perf = model.performance;
  const span = (c: typeof perf.revenueCagr) =>
    c.fromYear != null && c.toYear != null ? `${c.fromYear}–${c.toYear}` : undefined;
  if (perf.years.length === 0) return <p className={styles.note}>{t("company.fundamental.verdict.performance.missing")}</p>;
  return (
    <>
      {model.staleAccountsYear != null ? <p className={styles.note}>{t("company.fundamental.stale", { year: model.staleAccountsYear })}</p> : null}
      <div className={styles.grid}>
        <Stat label={t("company.fundamental.field.revenueCagr")} value={`${pct(perf.revenueCagr.cagr, 1, true)}${span(perf.revenueCagr) ? ` (${span(perf.revenueCagr)})` : ""}`} />
        <Stat label={t("company.fundamental.field.netCagr")} value={`${pct(perf.netIncomeCagr.cagr, 1, true)}${span(perf.netIncomeCagr) ? ` (${span(perf.netIncomeCagr)})` : ""}`} />
        <Stat
          label={t("company.fundamental.field.revenueYoy")}
          value={
            perf.latestRevenueGrowthYear != null
              ? `${pct(perf.latestRevenueGrowthPercent, 1, true)} · ${perf.latestRevenueGrowthYear}`
              : nd
          }
        />
        <Stat
          label={t("company.fundamental.field.opMargin")}
          value={perf.latestOperatingMarginYear != null ? `${pct(perf.latestOperatingMarginPercent, 1)} · ${perf.latestOperatingMarginYear}` : nd}
        />
        <Stat
          label={t("company.fundamental.field.netMargin")}
          value={
            perf.latestNetMarginYear != null
              ? `${pct(perf.latestNetMarginPercent, 1)} · ${perf.latestNetMarginYear}${
                  perf.prevNetMarginPercent != null ? ` · ${t("company.fundamental.prev", { value: pct(perf.prevNetMarginPercent, 1) })}` : ""
                }`
              : nd
          }
        />
        <Stat
          label={t("company.fundamental.field.roe")}
          value={
            perf.roePercent == null
              ? nd
              : `${pct(perf.roePercent, 1)}${perf.prevRoePercent != null ? ` · ${t("company.fundamental.prev", { value: pct(perf.prevRoePercent, 1) })}` : ""}`
          }
        />
        <Stat label={t("company.fundamental.field.roa")} value={nd} />
        <Stat
          label={t("company.fundamental.field.debt")}
          value={
            perf.debtRatio == null
              ? nd
              : `${pct(perf.debtRatio, 1)}${perf.prevDebtRatio != null ? ` · ${t("company.fundamental.prev", { value: pct(perf.prevDebtRatio, 1) })}` : ""}`
          }
        />
      </div>
      <p className={styles.note}>{t("company.fundamental.roaNote")}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("company.fundamental.table.year")}</th>
              <th scope="col">{t("company.fundamental.table.revenue")}</th>
              <th scope="col">{t("company.fundamental.table.operating")}</th>
              <th scope="col">{t("company.fundamental.table.net")}</th>
              <th scope="col">{t("company.fundamental.table.opMargin")}</th>
              <th scope="col">{t("company.fundamental.table.netMargin")}</th>
              <th scope="col">{t("company.fundamental.table.eps")}</th>
              <th scope="col">{t("company.fundamental.table.payout")}</th>
            </tr>
          </thead>
          <tbody>
            {[...perf.years].reverse().map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{bn(y.revenue)}</td>
                <td>{bn(y.operatingIncome)}</td>
                <td>{bn(y.netIncome)}</td>
                <td>{pct(y.operatingMargin, 1)}</td>
                <td>{pct(y.netMargin, 1)}</td>
                <td>{fcfa(y.eps)}</td>
                <td>{pct(y.payoutPercent, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{marketCopy(t, market, "accountsNote")}</p>
    </>
  );
}

function Outlook({
  model,
  t,
  locale,
  pct,
  market,
}: {
  model: Model;
  t: TFunc;
  locale: "fr" | "en";
  pct: (v: number | null, d?: number, s?: boolean) => string;
  market: FundamentalMarket;
}) {
  const synthesis = model.outlook.synthesis;
  if (!synthesis) return <p className={styles.note}>{marketCopy(t, market, "outlookEmpty")}</p>;
  const summary = outlookSummary(synthesis, locale);
  const growth = model.outlook.sectorGrowth;
  const ownGrowth = model.performance.latestRevenueGrowthPercent;
  const nd = t("common.nd");
  const hasText = summary.bullets.length + summary.watch.length + synthesis.items.length > 0;
  return (
    <>
      <p className={styles.lead}>{t("company.fundamental.outlookFigures")}</p>
      <div className={styles.grid}>
        <Stat
          label={t("company.fundamental.field.revenueYoy")}
          value={
            model.performance.latestRevenueGrowthYear != null
              ? `${pct(ownGrowth, 1, true)} · ${model.performance.latestRevenueGrowthYear}`
              : nd
          }
        />
        <Stat
          label={t("company.fundamental.field.netMargin")}
          value={
            model.performance.latestNetMarginYear != null
              ? `${pct(model.performance.latestNetMarginPercent, 1)} · ${model.performance.latestNetMarginYear}`
              : nd
          }
        />
        <Stat label={t("ngx.sheet.sector.median")} value={growth.median == null ? nd : pct(growth.median, 1, true)} />
      </div>
      {!hasText ? <p className={styles.note}>{marketCopy(t, market, "outlookEmpty")}</p> : null}
      {summary.bullets.length > 0 ? (
        <ul className={styles.list}>
          {summary.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {summary.watch.length > 0 ? (
        <ul className={styles.list}>
          {summary.watch.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {synthesis.items.length > 0 ? <h4 className={styles.sub}>{t("company.fundamental.guidance")}</h4> : null}
      {synthesis.items.map((item, i) => (
        <p key={`${item.type}-${i}`} className={styles.item}>
          <span className={styles.meta}>{t(`company.fundamental.itemType.${item.type}`)}</span>
          {outlookText(item, locale)}
          <span className={styles.meta}>
            {[item.date, item.sourceName, item.confidence].filter(Boolean).join(" · ") || t("common.nd")}
            {item.url ? (
              <>
                {" · "}
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.sourceName || item.url}
                </a>
              </>
            ) : null}
          </span>
        </p>
      ))}
      <p className={styles.note}>
        {growth.median == null
          ? t("company.fundamental.outlookSectorEmpty")
          : t("company.fundamental.outlookSector", { value: pct(growth.median, 1, true), count: growth.n })}
      </p>
    </>
  );
}

function Price({
  model,
  t,
  format,
  nd,
  bn,
  fcfa,
  pct,
  multiple,
  market,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  nd: string;
  bn: (v: number | null) => string;
  fcfa: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  multiple: (status: string, value: number | null, asMult?: boolean) => string;
  market: FundamentalMarket;
}) {
  const price = model.price;
  const liq = model.liquidity;
  const stats = liq.stats;
  return (
    <>
      <Illiquid model={model} t={t} format={format} market={market} />
      {liq.level === "ND" ? <p className={styles.note}>{t("company.fundamental.liquidityNd")}</p> : null}
      {model.staleAccountsYear != null ? <p className={styles.note}>{t("company.fundamental.stale", { year: model.staleAccountsYear })}</p> : null}
      <div className={styles.grid}>
        <Stat label={t("company.fundamental.field.price")} value={fcfa(price.close)} />
        <Stat label={t("company.fundamental.field.cap")} value={bn(price.marketCapBn)} />
        <Stat label={t("company.fundamental.field.per")} value={multiple(price.per.status, price.per.value)} />
        <Stat label={t("company.fundamental.field.pbr")} value={multiple(price.pbr.status, price.pbr.value)} />
        <Stat label={t("company.fundamental.field.yield")} value={pct(price.yieldPercent, 2)} />
        <Stat label={t("company.fundamental.field.roe")} value={price.roeStatus === "ok" ? pct(price.roePercent, 1) : multiple(price.roeStatus, null, false)} />
        <Stat label={t("company.fundamental.field.netMargin")} value={pct(price.netMarginPercent, 1)} />
        <Stat label={t("company.fundamental.field.debt")} value={pct(price.debtRatio, 1)} />
        <Stat label={t("company.fundamental.field.fcf")} value={bn(price.fcfBn)} />
        <Stat
          label={t("company.fundamental.field.eps")}
          value={price.impliedEps == null ? nd : `${fcfa(price.impliedEps)}${price.impliedEpsYear ? ` · ${price.impliedEpsYear}` : ""}`}
        />
        <Stat label={t("company.fundamental.field.avgValue")} value={liq.avgDailyValueFcfa == null ? nd : format.integer(liq.avgDailyValueFcfa)} />
        <Stat label={t("company.fundamental.field.avgVolume")} value={liq.avgShareVolume == null ? nd : format.integer(liq.avgShareVolume)} />
        <Stat label={t("company.fundamental.field.traded")} value={liq.tradedSessionsRatio == null ? nd : pct(liq.tradedSessionsRatio * 100, 0)} />
        <Stat label={t("company.fundamental.field.return3m")} value={pct(stats.return3mPercent, 1, true)} />
        <Stat label={t("company.fundamental.field.return1y")} value={pct(stats.return1yPercent, 1, true)} />
        <Stat label={t("company.fundamental.field.low52")} value={fcfa(stats.low52)} />
        <Stat label={t("company.fundamental.field.high52")} value={fcfa(stats.high52)} />
        <Stat
          label={t("company.fundamental.field.rangePos")}
          value={
            price.close != null && stats.low52 != null && stats.high52 != null && stats.high52 > stats.low52
              ? t("company.fundamental.inRange", {
                  value: format.percent(((price.close - stats.low52) / (stats.high52 - stats.low52)) * 100, 0),
                })
              : nd
          }
        />
        <Stat label={t("company.fundamental.field.drawdown")} value={pct(stats.drawdownFromHighPercent, 1)} />
        <Stat label={t("company.fundamental.field.volatility")} value={pct(stats.volatilityPercent, 1)} />
      </div>
      {price.per.status === "outlier" && price.per.recorded != null ? (
        <p className={styles.note}>
          {t("company.fundamental.outlierPer", { value: format.decimal(price.per.recorded, 1), max: PER_NOT_SIGNIFICANT_ABOVE })}
        </p>
      ) : null}
      {price.epsBlocked === "outlier" && price.impliedPer != null ? (
        <p className={styles.note}>
          {t("company.fundamental.outlierEps", {
            eps: fcfa(price.impliedEps),
            price: fcfa(price.close),
            per: format.decimal(price.impliedPer, 1),
            max: PER_NOT_SIGNIFICANT_ABOVE,
          })}
        </p>
      ) : null}
      {price.epsBlocked === "negative" ? <p className={styles.note}>{t("company.fundamental.negativeEpsNote")}</p> : null}
      <p className={styles.note}>{marketCopy(t, market, "ratiosNote")}</p>
      <p className={styles.note}>
        {t("company.fundamental.epsNote", { year: price.impliedEpsYear ?? "" })} {marketCopy(t, market, "noEquity")}
      </p>
    </>
  );
}

function Valuation({
  model,
  t,
  format,
  nd,
  fcfa,
  pct,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  nd: string;
  fcfa: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
}) {
  const { summary, estimates, skipped, rangeMode, historicalPer } = model.valuation;
  const hist = historicalPer;
  return (
    <>
      {rangeMode === "none" ? (
        <p className={styles.note}>{t("ngx.sheet.valuation.empty")}</p>
      ) : (
        <div className={styles.grid}>
          {rangeMode === "single" ? (
            <Stat label={t("company.fundamental.oneMethod")} value={fcfa(summary.mid)} />
          ) : (
            <Stat label={t("ngx.sheet.valuation.range")} value={`${fcfa(summary.low)} – ${fcfa(summary.high)}`} />
          )}
          {rangeMode === "range" ? <Stat label={t("ngx.sheet.valuation.mid")} value={fcfa(summary.mid)} /> : null}
          <Stat label={t("company.fundamental.field.gap")} value={pct(summary.gapToMidPercent, 0, true)} />
        </div>
      )}
      {rangeMode === "single" && estimates[0] ? (
        <p className={styles.note}>{t("company.fundamental.singleMethod", { method: methodLabel(t, estimates[0].method) })}</p>
      ) : null}
      {estimates.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("company.fundamental.table.method")}</th>
                <th scope="col">{t("company.fundamental.table.value")}</th>
                <th scope="col">{t("company.fundamental.table.gap")}</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.method}>
                  <td>
                    {methodLabel(t, e.method)}
                    {e.lowConfidence ? <span className={styles.meta}>{t("ngx.sheet.valuation.lowConfidence")}</span> : null}
                  </td>
                  <td>{fcfa(e.value)}</td>
                  <td>{format.percent(e.priceGapPercent, 0, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {skipped.length > 0 ? (
        <>
          <h4 className={styles.sub}>{t("company.fundamental.skippedTitle")}</h4>
          <ul className={styles.list}>
            {skipped.map((s) => (
              <li key={s.method}>
                {methodLabel(t, s.method)} — {skipLabel(t, s.reason)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className={styles.note}>{t("company.fundamental.howYield")}</p>
      <p className={styles.note}>{t("company.fundamental.howPb")}</p>
      <p className={styles.note}>{t("company.fundamental.howDdm")}</p>
      <p className={styles.note}>
        {hist
          ? t("company.fundamental.howHist", { from: hist.fromYear, to: hist.toYear, count: hist.n, max: PER_NOT_SIGNIFICANT_ABOVE })
          : t("company.fundamental.skip.thinHistory")}
      </p>
      {rangeMode !== "none" ? (
        <p className={styles.note}>
          {t("ngx.sheet.valuation.band", { percent: VALUATION_BAND_PERCENT })} {t("ngx.sheet.valuation.indicative")}
        </p>
      ) : null}
      <p className={styles.srOnly}>{nd}</p>
    </>
  );
}

function Sector({
  model,
  t,
  format,
  nd,
  pct,
  mult,
  market,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  nd: string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  mult: (v: number | null) => string;
  market: FundamentalMarket;
}) {
  const { rows, name, lowConfidence } = model.sector;
  const usable = rows.some((r) => r.stat.median != null);
  const isRatio = (k: string) => k === "per" || k === "pbr";
  const show = (k: string, v: number | null) => (isRatio(k) ? mult(v) : pct(v, 1));
  return (
    <>
      <p className={styles.lead}>{t("ngx.sheet.sector.lead", { sector: name || nd })}</p>
      {!usable ? (
        <p className={styles.note}>{t("ngx.sheet.sector.empty")}</p>
      ) : (
        <>
          {lowConfidence ? <p className={styles.note}>{t("company.fundamental.field.lowConfidence")}</p> : null}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("company.fundamental.table.metric")}</th>
                  <th scope="col">{t("company.fundamental.table.company")}</th>
                  <th scope="col">{t("company.fundamental.table.median")}</th>
                  <th scope="col">{t("company.fundamental.table.gap")}</th>
                  <th scope="col">{t("company.fundamental.table.n")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.key === "revenueGrowth"
                        ? t("company.fundamental.field.revenueYoy")
                        : t(
                            `ngx.sheet.sector.metrics.${r.key as "per" | "pbr" | "yield" | "netMargin" | "roe"}`,
                          )}
                    </td>
                    <td>
                      {r.stale || r.excluded === "outlier" || r.excluded === "negative"
                        ? t("company.fundamental.notSignificant")
                        : show(r.key, r.company)}
                      {r.position ? <span className={styles.meta}>{t(`company.fundamental.position.${r.position}`)}</span> : null}
                      {r.rank != null ? (
                        <span className={styles.meta}>{t("company.fundamental.rank", { rank: r.rank, count: r.rankedCount })}</span>
                      ) : null}
                    </td>
                    <td>
                      {show(r.key, r.stat.median)}
                      {r.stat.median != null && r.stat.lowConfidence ? "*" : ""}
                    </td>
                    <td>
                      {isRatio(r.key)
                        ? r.gapPercent == null
                          ? nd
                          : format.percent(r.gapPercent, 0, true)
                        : r.pointGap == null
                          ? nd
                          : `${format.signed(r.pointGap, 1)} ${t("company.fundamental.table.points")}`}
                    </td>
                    <td>{r.stat.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className={styles.note}>
        {t("company.fundamental.howMedian", {
          sector: name || nd,
          max: PER_NOT_SIGNIFICANT_ABOVE,
          yieldMax: YIELD_NOT_SIGNIFICANT_ABOVE,
        })}
      </p>
      <p className={styles.note}>{t("company.fundamental.peerIntro", { count: model.sector.peerCount })}</p>
      {rows[0] && rows[0].peers.length > 0 ? (
        <>
          <h4 className={styles.sub}>{t("company.fundamental.referencesTitle")}</h4>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("company.fundamental.table.ticker")}</th>
                  {rows.map((r) => (
                    <th key={r.key} scope="col">
                      {r.key === "revenueGrowth"
                        ? t("company.fundamental.field.revenueYoy")
                        : t(`ngx.sheet.sector.metrics.${r.key as "per" | "pbr" | "yield" | "netMargin" | "roe"}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("company.fundamental.thisCompany")}</td>
                  {rows.map((r) => (
                    <td key={r.key}>
                      {r.excluded === "outlier" || r.excluded === "negative"
                        ? `${r.recorded == null ? nd : show(r.key, r.recorded)} (${t("company.fundamental.excluded")})`
                        : r.stale
                          ? t("company.fundamental.notSignificant")
                          : show(r.key, r.company)}
                    </td>
                  ))}
                </tr>
                {rows[0].peers.map((peer) => (
                  <tr key={peer.ticker}>
                    <td>
                      <Link className={styles.peerLink} href={peerSheetHref(market, peer.ticker)}>
                        {peer.ticker}
                      </Link>
                      <span className={styles.meta}>{peer.name}</span>
                    </td>
                    {rows.map((r) => {
                      const ref = r.peers.find((p) => p.ticker === peer.ticker);
                      if (!ref || ref.value == null) return <td key={r.key}>{nd}</td>;
                      return (
                        <td key={r.key}>
                          {show(r.key, ref.value)}
                          {ref.included ? "" : ` (${t("company.fundamental.excluded")})`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <p className={styles.note}>{t("company.fundamental.sectorNote")}</p>
      {market === "NGX" ? <p className={styles.note}>{t("company.fundamental.ngx.growthNote")}</p> : null}
    </>
  );
}

function Dividends({
  model,
  t,
  format,
  nd,
  fcfa,
  pct,
  day,
  market,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  nd: string;
  fcfa: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  day: (iso: string | null) => string;
  market: FundamentalMarket;
}) {
  const d = model.dividends;
  if (d.lines.length === 0) return <p className={styles.note}>{t("ngx.sheet.dividends.empty")}</p>;
  const unknown = d.yearsPaid ? d.yearsPaid.window - d.yearsPaid.known : 0;
  return (
    <>
      <div className={styles.grid}>
        <Stat label={t("company.fundamental.field.dps")} value={fcfa(d.currentDps)} />
        <Stat label={t("company.fundamental.field.yield")} value={pct(d.currentYieldPercent, 2)} />
        <Stat
          label={t("company.fundamental.field.yearsPaid")}
          value={
            d.yearsPaid && d.yearsPaid.known > 0
              ? t("company.fundamental.field.yearsPaidValue", { paid: d.yearsPaid.paid, window: d.yearsPaid.window })
              : nd
          }
        />
        <Stat label={t("company.fundamental.field.growth")} value={pct(d.growthPercent, 0, true)} />
        <Stat label={t("company.fundamental.field.payout")} value={pct(d.payoutPercent, 0)} />
      </div>
      {unknown > 0 ? <p className={styles.note}>{t("ngx.sheet.dividends.yearsUnknown", { count: unknown })}</p> : null}
      {d.currentStatus === "UNCONFIRMED" ? <p className={styles.note}>{t("ngx.sheet.dividends.unconfirmed")}</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("company.fundamental.table.year")}</th>
              <th scope="col">{t("company.fundamental.field.dps")}</th>
              <th scope="col">{t("company.fundamental.field.payout")}</th>
              <th scope="col">{t("company.fundamental.table.exDate")}</th>
              <th scope="col">{t("company.fundamental.table.payment")}</th>
              <th scope="col">{t("company.fundamental.table.source")}</th>
            </tr>
          </thead>
          <tbody>
            {d.missingYears.map((year) => (
              <tr key={`nd-${year}`}>
                <td>{year}</td>
                <td colSpan={5}>{t("company.fundamental.table.unconfirmed")}</td>
              </tr>
            ))}
            {d.lines.map((l) => (
              <tr key={l.year}>
                <td>{l.year}</td>
                <td>{format.decimal(l.dps, 2)}</td>
                <td>{pct(l.payoutPercent, 0)}</td>
                <td>{day(l.exDate)}</td>
                <td>{day(l.paymentDate)}</td>
                <td>{l.source || nd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{marketCopy(t, market, "dividendNote")}</p>
    </>
  );
}

function criterionValue(c: PolicyCriterion, t: TFunc, format: FormatApi, fcfaCompact: (v: number) => string, v: number | null): string {
  const nd = t("common.nd");
  if (v == null || NO_VALUE.has(c.key)) return nd;
  if (c.key === "liquidity") return fcfaCompact(v);
  if (INTEGER.has(c.key)) return format.integer(v);
  return format.percent(v, c.key === "earningsConsistency" ? 0 : 1);
}

function Conclusion({
  model,
  t,
  format,
  locale,
  nd,
  fcfa,
  pct,
  market,
  preferredPortfolioType,
}: {
  model: Model;
  t: TFunc;
  format: FormatApi;
  locale: "fr" | "en";
  nd: string;
  fcfa: (v: number | null) => string;
  pct: (v: number | null, d?: number, s?: boolean) => string;
  market: FundamentalMarket;
  preferredPortfolioType: PortfolioTypeId | null;
}) {
  const compact = (v: number) => format.number(v, { notation: "compact", maximumFractionDigits: 1 });
  const fcfaCompact = (v: number) => (market === "NGX" ? `${compact(v)} ₦` : `${compact(v)} FCFA`);
  const label = (id: PortfolioTypeId) => localizedTypeDef(getPortfolioTypeDef(id), locale);
  const match = preferredPortfolioType != null && model.adapted.includes(preferredPortfolioType) ? preferredPortfolioType : null;
  return (
    <>
      <Illiquid model={model} t={t} format={format} market={market} />
      <h4 className={styles.sub}>{t("company.fundamental.adaptedTitle")}</h4>
      {match ? <p className={styles.match}>{t("company.fundamental.match", { type: label(match).label })}</p> : null}
      {model.adapted.length === 0 ? <p className={styles.note}>{t("company.fundamental.noneAdapted")}</p> : null}
      <div className={styles.policies}>
        {model.policies.map((p) => {
          const def = label(p.type);
          const tone = p.verdict === "FAVORABLE" ? styles.good : p.verdict === "UNFAVORABLE" ? styles.bad : p.verdict === "MIXED" ? styles.mid : styles.nd;
          const yours = preferredPortfolioType === p.type;
          return (
            <article key={p.type} className={`${styles.policy} ${yours && match ? styles.policyMatch : ""}`}>
              <header>
                <h4>
                  {def.label}
                  {yours ? <span className={styles.meta}>{t("company.fundamental.yourType")}</span> : null}
                </h4>
                <span className={`${styles.badge} ${tone}`}>{t(`ngx.sheet.conclusion.verdict.${p.verdict}`)}</span>
              </header>
              <p className={styles.note}>{t("company.fundamental.horizon", { horizon: def.horizon })}</p>
              <p className={styles.note}>{def.tagline}</p>
              <p className={styles.note}>{t("company.fundamental.criteria", { ok: p.okCount, count: p.evaluated })}</p>
              <ul className={styles.criteria}>
                {p.criteria.map((c) => {
                  const dot = c.status === "OK" ? styles.dotOk : c.status === "NEUTRAL" ? styles.dotNeutral : c.status === "KO" ? styles.dotKo : "";
                  const showThreshold = c.threshold != null && !NO_VALUE.has(c.key);
                  return (
                    <li key={c.key}>
                      <span className={styles.cLabel}>
                        <span className={`${styles.dot} ${dot}`} aria-hidden="true" />
                        {t(`ngx.sheet.conclusion.criterion.${c.key}`)}
                      </span>
                      <span className={styles.cValue}>
                        {c.key === "valuation" && model.valuation.summary.verdict !== "UNKNOWN"
                          ? t(`ngx.sheet.valuation.verdict.${model.valuation.summary.verdict}`)
                          : criterionValue(c, t, format, fcfaCompact, c.value)}
                        <span className={styles.srOnly}> — {t(`ngx.sheet.conclusion.status.${c.status}`)}</span>
                      </span>
                      {showThreshold ? (
                        <span className={styles.cThreshold}>
                          {t("company.fundamental.threshold", {
                            value: `${CEILING.has(c.key) ? "≤" : "≥"} ${criterionValue(c, t, format, fcfaCompact, c.threshold)}`,
                          })}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className={styles.note}>
                <Link className={styles.edu} href={def.educationHref}>
                  {def.label}
                </Link>
              </p>
            </article>
          );
        })}
      </div>
      {model.partial.length > 0 ? (
        <p className={styles.note}>
          {t("company.fundamental.partialTitle")} : {model.partial.map((id) => label(id).label).join(", ")}
        </p>
      ) : null}
      {model.unfavorable.length > 0 ? (
        <p className={styles.note}>
          {t("company.fundamental.unfavorableTitle")} : {model.unfavorable.map((id) => label(id).label).join(", ")}
        </p>
      ) : null}
      {model.insufficient.length > 0 ? (
        <p className={styles.note}>
          {t("company.fundamental.insufficientTitle")} : {model.insufficient.map((id) => label(id).label).join(", ")}
        </p>
      ) : null}
      <p className={styles.note}>
        <Link className={styles.edu} href={`/education/${PORTFOLIO_TYPE_THEME_SLUG}`}>
          {t("company.fundamental.education")}
        </Link>
      </p>
      <p className={styles.note}>{t("company.fundamental.disclaimer")}</p>
      <p className={styles.srOnly}>{nd}</p>
    </>
  );
}
