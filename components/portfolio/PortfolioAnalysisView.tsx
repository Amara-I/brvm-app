import Link from "next/link";
import { getI18n } from "@/lib/i18n/get-i18n";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { FormatApi } from "@/lib/i18n/format";
import type {
  CoherenceCode,
  HoldingAnalysis,
  PortfolioAnalysis,
  ProposalAction,
  ReasonCode,
} from "@/lib/portfolio-analysis/analyze";
import type { MarketAssessment, MacroReading } from "@/lib/portfolio-analysis/market-regime";
import styles from "./PortfolioAnalysis.module.css";

function nd(value: string | null | undefined, missing: string): string {
  return value == null || value === "" ? missing : value;
}

function shares(format: FormatApi, value: number | null, missing: string): string {
  if (value == null || !Number.isFinite(value)) return missing;
  return Number.isInteger(value) ? format.integer(value) : format.decimal(value, 2);
}

function actionClass(action: ProposalAction): string {
  if (action === "ALLEGER" || action === "SORTIR") return styles.badgeWarn;
  if (action === "RENFORCER") return styles.badgeOk;
  if (action === "SURVEILLER") return styles.badgeStop;
  return styles.badge;
}

export default function PortfolioAnalysisView({
  analyses,
  profileTableReady,
}: {
  analyses: PortfolioAnalysis[];
  profileTableReady: boolean;
}) {
  const { t, format } = getI18n();
  const missing = t("common.nd");
  const fx = analyses.find((analysis) => analysis.fx.ngnPerEur != null)?.fx ?? analyses[0]?.fx;

  return (
    <div className={styles.stack}>
      <p className={styles.note}>{t("portfolio.analysis.disclaimer")}</p>
      <div className={styles.links}>
        <Link href="/education/taille-position" className="ob-btn-secondary">
          {t("portfolio.analysis.education")}
        </Link>
        <Link href="/profil" className="ob-btn-secondary">
          {t("portfolio.analysis.profileLink")}
        </Link>
        <Link href="/portefeuille" className="ob-btn-secondary">
          {t("portfolio.analysis.back")}
        </Link>
      </div>
      {!profileTableReady ? <p className={styles.note}>{t("portfolio.analysis.migrationNote")}</p> : null}
      {fx?.ngnPerEur != null ? (
        <p className={styles.note}>
          {t("portfolio.analysis.fxAttribution", {
            ngn: format.decimal(fx.ngnPerEur, 2),
            source: fx.source ?? missing,
            date: fx.asOf ?? missing,
          })}
        </p>
      ) : (
        <p className={styles.note}>
          {t("portfolio.analysis.kpis.fx")} : {missing}
        </p>
      )}

      {analyses.length === 0 ? (
        <section className="ob-card ob-card-pad">
          <h2 className={styles.sectionTitle}>{t("portfolio.analysis.emptyTitle")}</h2>
          <p className={styles.note}>{t("portfolio.analysis.emptyBody")}</p>
        </section>
      ) : null}

      {analyses.map((analysis) => (
        <PortfolioBlock key={analysis.portfolioId} analysis={analysis} t={t} format={format} missing={missing} />
      ))}
    </div>
  );
}

function PortfolioBlock({
  analysis,
  t,
  format,
  missing,
}: {
  analysis: PortfolioAnalysis;
  t: TFunc;
  format: FormatApi;
  missing: string;
}) {
  const moves = analysis.proposals.filter((proposal) => proposal.action !== "CONSERVER").length;
  return (
    <section className={styles.stack} aria-labelledby={`analysis-${analysis.portfolioId}`}>
      <h2 id={`analysis-${analysis.portfolioId}`} className={styles.sectionTitle}>
        {analysis.portfolioName}
      </h2>
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span>{t("portfolio.analysis.kpis.capital")}</span>
          <strong>{analysis.capitalFcfa == null ? missing : format.fcfa(analysis.capitalFcfa)}</strong>
          <p className={styles.note}>{t(`portfolio.analysis.capitalSource.${analysis.capitalSource}`)}</p>
        </div>
        <div className={styles.kpi}>
          <span>{t("portfolio.analysis.kpis.risk")}</span>
          <strong>{format.percent(analysis.riskPercent, 2)}</strong>
          <p className={styles.note}>{t(`portfolio.analysis.riskSource.${analysis.riskSource}`)}</p>
        </div>
        <div className={styles.kpi}>
          <span>{t("portfolio.analysis.kpis.proposals")}</span>
          <strong>{format.integer(moves)}</strong>
        </div>
        <div className={styles.kpi}>
          <span>{t("portfolio.analysis.kpis.fx")}</span>
          <strong>{analysis.fx.xofPerNgn == null ? missing : format.decimal(analysis.fx.xofPerNgn, 4)}</strong>
        </div>
      </div>

      {analysis.unconvertedTickers.length > 0 ? (
        <p className={styles.note}>{t("portfolio.analysis.unconverted", { tickers: analysis.unconvertedTickers.join(", ") })}</p>
      ) : null}

      <div className={styles.grid2}>
        <MarketCard market="BRVM" assessment={analysis.markets.BRVM} t={t} format={format} missing={missing} />
        <MarketCard market="NGX" assessment={analysis.markets.NGX} t={t} format={format} missing={missing} />
      </div>

      <section className="ob-card ob-card-pad">
        <h3 className={styles.sectionTitle}>{t("portfolio.analysis.sections.macro")}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("portfolio.analysis.sections.macro")}</th>
                <th scope="col">{t("portfolio.analysis.fields.asOf")}</th>
                <th scope="col">{t("common.source")}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.macros.map((reading) => (
                <MacroRow key={reading.id} reading={reading} t={t} format={format} missing={missing} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ob-card ob-card-pad">
        <h3 className={styles.sectionTitle}>{t("portfolio.analysis.sections.diagnosis")}</h3>
        {analysis.coherence.length === 0 ? (
          <p className={styles.note}>{t("portfolio.analysis.noMoves")}</p>
        ) : (
          <ul className={styles.list}>
            {analysis.coherence.map((code) => (
              <li key={code}>{t(`portfolio.analysis.coherence.${code as CoherenceCode}`)}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="ob-card ob-card-pad">
        <h3 className={styles.sectionTitle}>{t("portfolio.analysis.sections.limits")}</h3>
        <p className={styles.note}>{t("portfolio.analysis.limitsNote")}</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("portfolio.analysis.columns.ticker")}</th>
                <th scope="col">{t("portfolio.analysis.columns.weight")}</th>
                <th scope="col">{t("portfolio.analysis.sections.limits")}</th>
                <th scope="col">{t("portfolio.analysis.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.buckets.map((bucket) => (
                <tr key={`${bucket.kind}:${bucket.key}`}>
                  <td>
                    {t(`portfolio.analysis.bucketKind.${bucket.kind}`)} · {bucket.label}
                  </td>
                  <td>{format.percent(bucket.weightPct, 1)}</td>
                  <td>{format.percent(bucket.limitPct, 0)}</td>
                  <td>{bucket.above ? t("portfolio.analysis.above") : t("portfolio.analysis.within")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.stack}>
        <h3 className={styles.sectionTitle}>{t("portfolio.analysis.sections.proposals")}</h3>
        {analysis.proposals.filter((proposal) => proposal.action !== "CONSERVER").length === 0 ? (
          <p className={styles.note}>{t("portfolio.analysis.noMoves")}</p>
        ) : (
          analysis.proposals
            .filter((proposal) => proposal.action !== "CONSERVER")
            .map((proposal) => (
              <article key={proposal.ticker} className={styles.proposal}>
                <h3>
                  <span className={actionClass(proposal.action)}>{t(`portfolio.analysis.actions.${proposal.action}`)}</span>{" "}
                  {proposal.ticker} — {proposal.name}
                </h3>
                <p>
                  {shares(format, proposal.currentShares, missing)} → {shares(format, proposal.suggestedShares, missing)}
                  {proposal.currentWeightPct == null ? "" : ` · ${format.percent(proposal.currentWeightPct, 1)}`}
                </p>
                <ul className={styles.list}>
                  {proposal.reasons.map((reason) => (
                    <li key={reason}>{t(`portfolio.analysis.reasons.${reason as ReasonCode}`)}</li>
                  ))}
                </ul>
              </article>
            ))
        )}
      </section>

      <section className="ob-card ob-card-pad">
        <h3 className={styles.sectionTitle}>{t("portfolio.analysis.sections.holdings")}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("portfolio.analysis.columns.ticker")}</th>
                <th scope="col">{t("portfolio.analysis.columns.market")}</th>
                <th scope="col">{t("portfolio.analysis.columns.weight")}</th>
                <th scope="col">{t("portfolio.analysis.columns.liquidity")}</th>
                <th scope="col">{t("portfolio.analysis.columns.current")}</th>
                <th scope="col">{t("portfolio.analysis.columns.suggested")}</th>
                <th scope="col">{t("portfolio.analysis.columns.rr")}</th>
                <th scope="col">{t("portfolio.analysis.columns.plan")}</th>
                <th scope="col">{t("portfolio.analysis.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.holdings.map((holding) => (
                <HoldingRow key={holding.ticker} holding={holding} t={t} format={format} missing={missing} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function MarketCard({
  market,
  assessment,
  t,
  format,
  missing,
}: {
  market: "BRVM" | "NGX";
  assessment: MarketAssessment;
  t: TFunc;
  format: FormatApi;
  missing: string;
}) {
  const breadth =
    assessment.breadthRatio == null
      ? missing
      : `${format.percent(assessment.breadthRatio * 100, 0)} · ${t("portfolio.analysis.breadthCount", {
          rising: assessment.breadthRising,
          falling: assessment.breadthFalling,
        })}`;
  return (
    <section className="ob-card ob-card-pad">
      <h3 className={styles.sectionTitle}>
        {t("portfolio.analysis.sections.market")} · {t(`portfolio.analysis.marketNames.${market}`)}
      </h3>
      <dl className={styles.dl}>
        <dt>{t("portfolio.analysis.fields.index")}</dt>
        <dd>{nd(assessment.indexName, missing)}</dd>
        <dt>{t("portfolio.analysis.fields.asOf")}</dt>
        <dd>{nd(assessment.asOf, missing)}</dd>
        <dt>{t("portfolio.analysis.fields.trend")}</dt>
        <dd>
          {t(`portfolio.analysis.direction.${assessment.direction}`)}
          {assessment.change1mPct == null ? "" : ` · ${t("portfolio.analysis.fields.change1m")} ${format.percent(assessment.change1mPct, 1, true)}`}
          {assessment.change3mPct == null ? "" : ` · ${t("portfolio.analysis.fields.change3m")} ${format.percent(assessment.change3mPct, 1, true)}`}
        </dd>
        <dt>{t("portfolio.analysis.fields.vol")}</dt>
        <dd>{assessment.realizedVolPct == null ? missing : format.percent(assessment.realizedVolPct, 1)}</dd>
        <dt>{t("portfolio.analysis.fields.breadth")}</dt>
        <dd>{breadth}</dd>
        <dt>{t("portfolio.analysis.fields.regime")}</dt>
        <dd>{t(`portfolio.analysis.regime.${assessment.regime}`)}</dd>
      </dl>
      <p className={styles.note}>{t(`portfolio.analysis.macroNote.${assessment.macroNote}`)}</p>
    </section>
  );
}

function MacroRow({
  reading,
  t,
  format,
  missing,
}: {
  reading: MacroReading;
  t: TFunc;
  format: FormatApi;
  missing: string;
}) {
  const value =
    reading.value == null
      ? missing
      : reading.unit === "percent"
        ? format.percent(reading.value, 2)
        : format.decimal(reading.value, 4);
  return (
    <tr>
      <th scope="row">
        {t(`portfolio.analysis.macroNames.${reading.id}`)} · {value}
      </th>
      <td>{nd(reading.asOf, missing)}</td>
      <td>{nd(reading.source, missing)}</td>
    </tr>
  );
}

function HoldingRow({
  holding,
  t,
  format,
  missing,
}: {
  holding: HoldingAnalysis;
  t: TFunc;
  format: FormatApi;
  missing: string;
}) {
  const sizing = holding.sizing;
  const formula =
    sizing?.riskBudgetFcfa == null
      ? null
      : t("portfolio.analysis.formula", {
          budget: format.fcfa(sizing.riskBudgetFcfa),
          perShare: sizing.riskPerShareFcfa == null ? missing : format.fcfa(sizing.riskPerShareFcfa),
          byRisk: shares(format, sizing.sharesByRisk, missing),
          weight: format.decimal(sizing.rewardWeight, 2),
          suggested: shares(format, sizing.suggestedShares, missing),
        });
  return (
    <tr className={holding.liquidity.band === "ILLIQUIDE" ? styles.illiquid : undefined}>
      <th scope="row">
        {holding.ticker}
        <div className={styles.formula}>{holding.name}</div>
        {formula ? <p className={styles.formula}>{formula}</p> : null}
      </th>
      <td>{holding.market}</td>
      <td>{holding.weightPct == null ? missing : format.percent(holding.weightPct, 1)}</td>
      <td>
        <span className={holding.liquidity.band === "ILLIQUIDE" ? styles.badgeWarn : styles.badge}>
          {t(`portfolio.analysis.bands.${holding.liquidity.band}`)}
        </span>
      </td>
      <td>{shares(format, holding.quantity, missing)}</td>
      <td>{shares(format, holding.proposal.suggestedShares, missing)}</td>
      <td>{holding.riskReward == null ? missing : format.decimal(holding.riskReward, 2)}</td>
      <td>{t(`portfolio.analysis.planSource.${holding.planSource}`)}</td>
      <td>
        <span className={actionClass(holding.proposal.action)}>{t(`portfolio.analysis.actions.${holding.proposal.action}`)}</span>
      </td>
    </tr>
  );
}
