import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker } from "@/lib/api/market-spark-series";
import { allCompaniesWithMetrics } from "@/lib/calc/market-summary-stats";
import ScreenerTable from "@/components/screener/ScreenerTable";
import { getViewer, presentScoredCompanies } from "@/lib/entitlements";
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
  const [dataset, sparkSeries, viewer] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker().catch(() => ({})),
    getViewer(),
  ]);
  const companies = presentScoredCompanies(allCompaniesWithMetrics(dataset, sparkSeries), viewer);

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("screener.kicker")}
          title={t("screener.title")}
          lead={t("screener.lead", { count: companies.length })}
        />
        {companies.length > 0 ? (
          <ScreenerTable companies={companies} gatedVisitor={viewer.gated} />
        ) : (
          <EmptyState title={t("screener.emptyTitle")} body={t("screener.emptyBody")} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
