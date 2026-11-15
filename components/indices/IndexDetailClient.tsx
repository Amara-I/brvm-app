"use client";

// Fiche d'un indice (BRVM ou NGX) : niveau, chiffres clés, courbe avec niveaux techniques,
// lecture de marché, participation des valeurs, analyse technique en points et composition.

import Link from "next/link";
import type { ReactNode } from "react";
import TechnicalAnalysisPanel from "@/components/actions/TechnicalAnalysisPanel";
import { useI18n } from "@/components/i18n/I18nProvider";
import IndexChart from "@/components/indices/IndexChart";
import { translateCompositionNote, translateIndexDescription, translateIndexFamily } from "@/components/indices/index-copy";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import ChangeValue from "@/components/ui/ChangeValue";
import ConfidenceDot from "@/components/ui/ConfidenceDot";
import KpiStat from "@/components/ui/KpiStat";
import SignalBadge from "@/components/ui/SignalBadge";
import type { FormatApi } from "@/lib/i18n/format";
import { buildIndexReading, indexReadingLabel, type IndexBreadth, type ReadingLine } from "@/lib/markets/index-insights";
import type { IndexPageData } from "@/lib/markets/index-page";
import styles from "./Indices.module.css";

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

function formatLevel(value: number | null | undefined, format: FormatApi): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  return format.decimal(value, 2);
}

function formatSessionDate(iso: string | null | undefined, format: FormatApi): string {
  if (!iso) return "N/D";
  return format.date(`${iso}T00:00:00.000Z`, NUMERIC_DATE);
}

function ReadingText({ line }: { line: ReadingLine }) {
  return (
    <li>
      {line.segments.map((seg, i) =>
        seg.strong ? (
          <strong
            key={i}
            className={seg.tone === "pos" ? styles.pos : seg.tone === "neg" ? styles.neg : styles.hl}
          >
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </li>
  );
}

function BreadthCard({
  breadth,
  stockHref,
}: {
  breadth: IndexBreadth;
  stockHref: (ticker: string) => string;
}) {
  const { t, format } = useI18n();
  const pct = (n: number) => (breadth.total > 0 ? (n / breadth.total) * 100 : 0);
  const chip = (row: { ticker: string; name: string; changePercent: number }) => (
    <li key={row.ticker}>
      <Link href={stockHref(row.ticker)} className={styles.moverLink} title={row.name}>
        <span className={styles.moverTicker}>{row.ticker}</span>
        <ChangeValue value={row.changePercent} />
      </Link>
    </li>
  );
  return (
    <section className={styles.card} aria-labelledby="index-breadth-title">
      <div className={styles.cardHead}>
        <h2 id="index-breadth-title" className={styles.cardTitle}>
          {t("market.indices.sheet.breadthTitle")}
        </h2>
        <span className={styles.meta}>
          {t("market.indices.sheet.breadthSession", { date: formatSessionDate(breadth.sessionDate, format) })}
        </span>
      </div>
      <p className={styles.note}>{t(`market.indices.sheet.basis.${breadth.basis}`)}</p>
      <div className={styles.breadthBar} role="img" aria-label={`${breadth.up} / ${breadth.flat} / ${breadth.down}`}>
        <span className={styles.breadthUp} style={{ width: `${pct(breadth.up)}%` }} />
        <span className={styles.breadthFlat} style={{ width: `${pct(breadth.flat)}%` }} />
        <span className={styles.breadthDown} style={{ width: `${pct(breadth.down)}%` }} />
      </div>
      <div className={styles.breadthCounts}>
        <span>
          <strong className={styles.pos}>{breadth.up}</strong> {t("market.indices.sheet.breadthUp")}
        </span>
        <span>
          <strong className={styles.hl}>{breadth.flat}</strong> {t("market.indices.sheet.breadthFlat")}
        </span>
        <span>
          <strong className={styles.neg}>{breadth.down}</strong> {t("market.indices.sheet.breadthDown")}
        </span>
      </div>
      <div className={styles.movers}>
        <div>
          <h3 className={styles.subTitle}>{t("market.indices.sheet.gainers")}</h3>
          {breadth.topGainers.length ? <ul className={styles.moverList}>{breadth.topGainers.map(chip)}</ul> : <p className={styles.empty}>N/D</p>}
        </div>
        <div>
          <h3 className={styles.subTitle}>{t("market.indices.sheet.losers")}</h3>
          {breadth.topLosers.length ? <ul className={styles.moverList}>{breadth.topLosers.map(chip)}</ul> : <p className={styles.empty}>N/D</p>}
        </div>
      </div>
    </section>
  );
}

export default function IndexDetailClient({
  data,
  backHref = "/indices",
  backLabel,
  stockHrefPrefix = "/actions/",
  extraHeader,
}: {
  data: IndexPageData;
  backHref?: string;
  backLabel?: string;
  /** Préfixe des fiches société (chaîne : une fonction ne traverse pas la frontière serveur → client). */
  stockHrefPrefix?: string;
  /** Lien supplémentaire sous l'en-tête (ex. graphe détaillé NGX). */
  extraHeader?: ReactNode;
}) {
  const { t, format, labels, locale } = useI18n();
  const stockHref = (ticker: string) => `${stockHrefPrefix}${encodeURIComponent(ticker)}`;
  const lang = locale === "en" ? "en" : "fr";
  const { detail, risk, analysis, breadth } = data;
  const { stats, composition } = detail;
  const history =
    stats.historyPoints > 0
      ? t(stats.historyPoints > 1 ? "market.indices.pointsMany" : "market.indices.pointsOne", {
          count: stats.historyPoints,
        })
      : t("market.indices.historyNd");
  const sectorName = (name: string) => labels.sector(name);
  const pctPlain = (v: number | null) => (v == null ? "N/D" : format.percent(v, 2, true));
  const reading = buildIndexReading({
    name: detail.name,
    locale: lang,
    lastValue: stats.lastValue,
    lastDate: stats.lastDate,
    sessionChangePercent: stats.sessionChangePercent,
    changeYtdPercent: stats.changeYtdPercent,
    change1YPercent: stats.change1YPercent,
    high52w: stats.high52w,
    low52w: stats.low52w,
    risk,
    analysis,
    breadth,
  });
  const showComposition = data.exchange === "BRVM";

  return (
    <div className={styles.sheet}>
      <header className={styles.detailHead}>
        <Link href={backHref} className={styles.back}>
          {backLabel ?? t("market.indices.back")}
        </Link>
        <p className="ob-kicker">
          {data.exchange === "BRVM" ? `${translateIndexFamily(detail.family, t)} · ` : "NGX · "}
          {detail.code.replace(/_/g, " ")}
        </p>
        <h1 className="ob-page-title">{detail.name}</h1>
        <div className={styles.levelRow}>
          <span className={styles.level}>
            {formatLevel(stats.lastValue, format)} <span className={styles.unit}>pts</span>
          </span>
          <ChangeValue value={stats.sessionChangePercent} pill />
        </div>
        <p className={styles.meta}>
          {t("market.indices.sessionMeta", {
            date: formatSessionDate(stats.lastDate, format),
            source: translateDataSourceLabel(detail.sourceLabel, t),
            history,
          })}
        </p>
        {data.exchange === "BRVM" ? (
          <p className={styles.note}>{translateIndexDescription(detail.code, detail.description, t, sectorName)}</p>
        ) : null}
        {extraHeader}
      </header>

      <div className={styles.kpiGrid}>
        <KpiStat label={t("market.indices.sheet.kpi.session")} value={<ChangeValue value={stats.sessionChangePercent} />} />
        <KpiStat label={t("market.indices.sheet.kpi.ytd")} value={<ChangeValue value={stats.changeYtdPercent} />} />
        <KpiStat label={t("market.indices.sheet.kpi.year")} value={<ChangeValue value={stats.change1YPercent} />} />
        <KpiStat
          label={t("market.indices.sheet.kpi.high52")}
          value={formatLevel(stats.high52w, format)}
          hint={risk.fromHigh52wPercent != null ? pctPlain(risk.fromHigh52wPercent) : t("market.indices.historyShort")}
        />
        <KpiStat
          label={t("market.indices.sheet.kpi.low52")}
          value={formatLevel(stats.low52w, format)}
          hint={risk.fromLow52wPercent != null ? pctPlain(risk.fromLow52wPercent) : t("market.indices.historyShort")}
        />
        <KpiStat
          label={t("market.indices.sheet.kpi.volatility")}
          value={risk.volatility1YPercent == null ? "N/D" : format.percent(risk.volatility1YPercent, 1)}
        />
        <KpiStat
          label={t("market.indices.sheet.kpi.drawdown")}
          value={<ChangeValue value={risk.maxDrawdown1YPercent} />}
        />
        <KpiStat
          label={t("market.indices.sheet.kpi.ath")}
          value={formatLevel(data.athValue, format)}
          hint={
            data.athDate
              ? `${formatSessionDate(data.athDate, format)}${
                  risk.fromAthPercent != null && risk.fromAthPercent < -0.005
                    ? ` · ${t("market.indices.sheet.kpi.fromAth", { value: pctPlain(risk.fromAthPercent) })}`
                    : ""
                }`
              : undefined
          }
        />
      </div>

      <IndexChart series={detail.series} analysis={analysis} />

      <section className={styles.card} aria-labelledby="index-reading-title">
        <div className={styles.cardHead}>
          <div>
            <h2 id="index-reading-title" className={styles.cardTitle}>
              {t("market.indices.sheet.readingTitle")}
            </h2>
            <p className={styles.note}>{t("market.indices.sheet.readingLead")}</p>
          </div>
          {analysis ? (
            <div className={styles.readingSignal}>
              <span className={styles.readingSignalLabel}>{t("market.indices.sheet.readingSignal")}</span>
              <SignalBadge label={analysis.signal.label} display={indexReadingLabel(analysis.signal.label, lang)} />
              <ConfidenceDot value={analysis.signal.confidence} />
            </div>
          ) : null}
        </div>
        {reading.length ? (
          <ul className={styles.reading}>
            {reading.map((line) => (
              <ReadingText key={line.id} line={line} />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>{t("market.indices.historyEmpty")}</p>
        )}
      </section>

      {breadth ? (
        <BreadthCard breadth={breadth} stockHref={stockHref} />
      ) : (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t("market.indices.sheet.breadthTitle")}</h2>
          <p className={styles.note} style={{ marginTop: 8, marginBottom: 0 }}>
            {t("market.indices.sheet.breadthNd")}
          </p>
        </section>
      )}

      {analysis ? <TechnicalAnalysisPanel analysis={analysis} qualityScore={null} variant="index" /> : null}

      {showComposition ? (
        <section className={styles.card} aria-labelledby="index-compo-title">
          <div className={styles.cardHead}>
            <h2 id="index-compo-title" className={styles.cardTitle}>
              {t("market.indices.composition")}
            </h2>
          </div>
          <p className={styles.note}>{translateCompositionNote(composition.note, t, sectorName)}</p>
          {composition.constituents.length === 0 ? (
            <p className={styles.empty}>{t("market.indices.constituentsNd")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className="ob-table">
                <thead>
                  <tr>
                    <th scope="col">{t("market.indices.col.ticker")}</th>
                    <th scope="col">{t("market.indices.col.company")}</th>
                    <th scope="col">{t("market.indices.col.sector")}</th>
                    <th scope="col">{t("market.indices.col.weight")}</th>
                    <th scope="col">{t("market.indices.col.price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {composition.constituents.map((row) => (
                    <tr key={row.ticker}>
                      <td>
                        <Link href={stockHref(row.ticker)} className={styles.constLink}>
                          {row.ticker}
                        </Link>
                      </td>
                      <td>{row.name}</td>
                      <td>{row.sector ? labels.sector(row.sector) : "N/D"}</td>
                      <td className="ob-num">
                        {row.weight == null || Number.isNaN(row.weight) ? "N/D" : format.percent(row.weight, 2)}
                      </td>
                      <td className="ob-num">
                        {row.lastPrice == null || !(row.lastPrice > 0) ? "N/D" : format.integer(row.lastPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
