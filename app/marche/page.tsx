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
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getUserPortfolioType } from "@/lib/auth/get-user-portfolio-type";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marché — OuestBourse",
  description:
    "Analyse multi-marchés africains : BRVM, BVMAC, NGX, NSE, JSE, GSE, TSE — cours, indices et signaux.",
};

export default async function MarchePage() {
  const userId = await getCurrentUserId().catch(() => null);
  const [dataset, marketSummary, sparkSeries, dayChanges, savedPortfolioType] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSummarySnapshot().catch(() => null),
    getMarketSparkSeriesByTicker().catch(() => ({})),
    getMarketDayChangeByTicker().catch(() => ({})),
    getUserPortfolioType(userId).catch(() => null),
  ]);
  return (
    <AppHeader>
      <MarketBoardClient
        initialData={dataset}
        initialMarketSummary={marketSummary}
        initialSparkSeries={sparkSeries}
        initialDayChanges={dayChanges}
        savedPortfolioType={savedPortfolioType}
        isAuthenticated={Boolean(userId)}
      />
      <SiteFooter />
    </AppHeader>
  );
}
