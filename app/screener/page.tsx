import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker } from "@/lib/api/market-spark-series";
import { allCompaniesWithMetrics } from "@/lib/calc/market-summary-stats";
import ScreenerTable from "@/components/screener/ScreenerTable";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("screener.metaTitle"),
    description: t("screener.metaDescription"),
  };
}

export default async function ScreenerPage() {
  const { t } = getI18n();
  const [dataset, sparkSeries] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker().catch(() => ({})),
  ]);
  const companies = allCompaniesWithMetrics(dataset, sparkSeries);

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("screener.kicker")}
          title={t("screener.title")}
          lead={t("screener.lead", { count: companies.length })}
        />
        {companies.length > 0 ? (
          <ScreenerTable companies={companies} />
        ) : (
          <EmptyState title={t("screener.emptyTitle")} body={t("screener.emptyBody")} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
