import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import { ngxBoardLabel, ngxSectorLabel } from "@/components/ngx/ngx-labels";
import styles from "@/components/ngx/NgxMarket.module.css";
import PageHeader from "@/components/ui/PageHeader";
import CompanyMark from "@/components/ui/CompanyMark";
import TickerAlertButton from "@/components/notifications/TickerAlertButton";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxCompany } from "@/lib/markets/ngx-browse";
import { loadNgxChartUniverse } from "@/lib/markets/ngx-chart";
import { loadNgxSheet } from "@/lib/markets/ngx-sheet";
import NgxSheetView from "@/components/ngx/sheet/NgxSheetView";
import NgxLiveQuote from "@/components/ngx/sheet/NgxLiveQuote";
import NgxSheetTabs from "@/components/ngx/sheet/NgxSheetTabs";
import NgxOverviewPriceCard from "@/components/ngx/sheet/NgxOverviewPriceCard";
import NgxTechnicalTab from "@/components/ngx/sheet/NgxTechnicalTab";
import sheetStyles from "@/components/ngx/sheet/NgxSheet.module.css";
import { FundamentalAnalysisBody } from "@/components/actions/FundamentalAnalysisPanel";
import SignalBadge from "@/components/ui/SignalBadge";
import ScoreBadge from "@/components/ui/ScoreBadge";
import ConfidenceDot from "@/components/ui/ConfidenceDot";
import ScoreSignalLegend from "@/components/ui/ScoreSignalLegend";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { ticker: string } }) {
  const { t } = getI18n();
  const company = await loadNgxCompany(params.ticker).catch(() => null);
  if (!company) return { title: t("ngx.market.metaTitle") };
  return {
    title: t("ngx.company.metaTitle", { name: company.name, ticker: company.ticker }),
    description: t("ngx.company.metaDescription", { name: company.name, ticker: company.ticker }),
  };
}

export default async function NgxCompanyPage({ params }: { params: { ticker: string } }) {
  const { t, format, labels, locale } = getI18n();
  const [data, chartUniverse, userId, preference] = await Promise.all([
    loadNgxSheet(params.ticker).catch(() => null),
    loadNgxChartUniverse().catch(() => []),
    getCurrentUserId().catch(() => null),
    getPreferredPortfolioType().catch(() => null),
  ]);
  if (!data) notFound();
  const { page: company, model, fundamental, technical, yearPrices } = data;
  const preferredPortfolioType = userId ? preference ?? null : null;
  const score = model.score.overall;
  const signal = technical.barsUsed > 0 ? technical.signal : null;
  const liquidityWarning = locale === "en" ? technical.liquidity.warningEn : technical.liquidity.warningFr;
  return (
    <AppHeader>
      <div className="ob-page">
        <div className={sheetStyles.column}>
        <p>
          <a className={styles.back} href="/marches/ngx/societes">
            ← {t("ngx.company.back")}
          </a>
        </p>
        <PageHeader
          kicker={`${company.ticker} · ${ngxSectorLabel(company.sectorSlug, company.sectorName, t)}`}
          title={company.name}
          lead={t("ngx.market.sourceLine", { source: translateDataSourceLabel(company.sourceLabel, t) })}
          mark={<CompanyMark ticker={company.ticker} name={company.name} size={52} market="NGX" />}
        />
        <div className={styles.hero}>
          <div>
            <span className={styles.sub}>{t("ngx.company.price")}</span>
            <NgxLiveQuote
              ticker={company.ticker}
              close={company.close}
              changePercent={company.changePercent}
              priceClassName={styles.heroPrice}
            />
            <div style={{ marginTop: "0.6rem" }}>
              <TickerAlertButton
                isAuthenticated={Boolean(userId)}
                ticker={company.ticker}
                market="NGX"
                lastClose={company.close}
                loginCallbackPath={`/marches/ngx/actions/${company.ticker}`}
              />
            </div>
          </div>
          <div>
            <span className={styles.sub}>{t("ngx.company.indicative")}</span>
            <div className={styles.heroPrice} style={{ fontSize: "1.4rem" }}>
              {company.indicativeFcfa == null ? "N/D" : format.money(company.indicativeFcfa, "XOF")}
            </div>
            <p className={styles.note}>{company.fx ? t("ngx.market.attribution") : t("ngx.company.indicativeMissing")}</p>
          </div>
        </div>
        <div className={styles.metaGrid} aria-label={t("ngx.company.overview.keyInfo")}>
          <div className={styles.kpi} data-testid="ngx-sheet-score">
            <span>{t("ngx.company.overview.score")}</span>
            <strong style={{ fontSize: "1rem" }}>
              {score == null ? t("ngx.company.overview.scoreNd") : <ScoreBadge score={score} outOf showTier />}
            </strong>
          </div>
          <div className={styles.kpi} data-testid="ngx-sheet-signal">
            <span>{t("ngx.company.overview.signal")}</span>
            <strong style={{ fontSize: "1rem" }}>
              {signal ? <SignalBadge label={signal.label} title={t("ngx.company.overview.signalNote")} confidence={signal.confidence} /> : "N/D"}
            </strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.company.overview.confidence")}</span>
            <strong style={{ fontSize: "1rem" }}>{signal ? <ConfidenceDot value={signal.confidence} /> : "N/D"}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("ngx.company.board")}</span>
            <strong style={{ fontSize: "1rem" }}>{ngxBoardLabel(company.board, t)}</strong>
          </div>
        </div>
        <p className={styles.note}>{t("ngx.company.overview.signalNote")}</p>
        <ScoreSignalLegend />
        {liquidityWarning ? (
          <p className={styles.note} role="status" data-testid="ngx-sheet-illiquid">
            ⚠ {liquidityWarning}
          </p>
        ) : null}
        <NgxSheetTabs
          ticker={company.ticker}
          panels={{
            overview: (
              <>
                <NgxOverviewPriceCard
                  ticker={company.ticker}
                  series={company.series.map((p) => ({ time: p.time, value: p.value, volume: p.volume ?? null }))}
                  sessionDate={company.sessionDate}
                />
                <NgxSheetView model={model} />
              </>
            ),
            fundamental: (
              <FundamentalAnalysisBody
                model={fundamental}
                series={company.series}
                yearPrices={yearPrices}
                market="NGX"
                amountsNote={
                  model.presentation.reportingCurrency?.ngnPerUsd != null
                    ? t("ngx.sheet.usdAccounts.tabNote", {
                        rate: format.decimal(model.presentation.reportingCurrency.ngnPerUsd, 2),
                        date: model.presentation.reportingCurrency.asOf ?? "N/D",
                      })
                    : undefined
                }
                preferredPortfolioType={preferredPortfolioType}
              />
            ),
            charts:
              company.series.length > 1 ? (
                <NgxTechnicalTab
                  symbol={company.ticker}
                  universe={chartUniverse}
                  isAuthenticated={Boolean(userId)}
                  initialAnalysis={technical}
                  qualityScore={score}
                />
              ) : (
                <p className={styles.note}>{t("ngx.company.chartEmpty")}</p>
              ),
          }}
        />
        </div>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
