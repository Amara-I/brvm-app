// Page "Marché" — liste positions + analyses ; Projection/Comparaison → fiches sociétés.
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSummarySnapshot } from "@/lib/api/market-summary-snapshot";
import {
  getMarketSparkSeriesByTicker,
  getMarketDayChangeByTicker,
} from "@/lib/api/market-spark-series";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MarketBoardClient from "@/components/marche/MarketBoardClient";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("market.metaTitle"),
    description: t("market.metaDescription"),
  };
}

export default async function MarchePage() {
  const [dataset, marketSummary, sparkSeries, dayChanges, preferredPortfolioType] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSummarySnapshot().catch(() => null),
    getMarketSparkSeriesByTicker().catch(() => ({})),
    getMarketDayChangeByTicker().catch(() => ({})),
    getPreferredPortfolioType().catch(() => null),
  ]);
  return (
    <AppHeader>
      <MarketBoardClient
        initialData={dataset}
        initialMarketSummary={marketSummary}
        initialSparkSeries={sparkSeries}
        initialDayChanges={dayChanges}
        preferredPortfolioType={preferredPortfolioType}
      />
      <SiteFooter />
    </AppHeader>
  );
}
