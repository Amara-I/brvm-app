// Page Graphes — catalogue de tous les graphes (actions et indices, toutes places),
// et workbench BRVM lorsqu'un ticker est demandé (?ticker=).
import AppHeader from "@/components/AppHeader";
import ChartWorkbench from "@/components/charts/LazyChartWorkbench";
import ChartCatalog, { ChartsBackLink } from "@/components/charts/ChartCatalog";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getChartCatalog } from "@/lib/charts/chart-catalog";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("charts.meta.title"),
    description: t("charts.meta.description"),
  };
}

export default async function GraphesPage({
  searchParams,
}: {
  searchParams?: { ticker?: string };
}) {
  const { t } = getI18n();
  const requested = searchParams?.ticker?.toUpperCase();

  if (requested) {
    const dataset = await getCompaniesFullDataset();
    const universe = dataset.companies.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      color: c.color,
      sector: c.sector,
      countryFlag: c.countryFlag,
    }));
    const initialTicker =
      (universe.some((u) => u.ticker === requested) && requested) ||
      (universe.some((u) => u.ticker === "ABJC") ? "ABJC" : null) ||
      (universe.some((u) => u.ticker === "SNTS") ? "SNTS" : universe[0]?.ticker ?? "SNTS");
    const userId = await getCurrentUserId().catch(() => null);

    return (
      <AppHeader>
        <div className="ob-page">
          <ChartsBackLink />
          <PageHeader
            kicker={t("charts.page.kicker")}
            title={t("charts.page.title")}
            lead={t("charts.page.workbenchLead")}
          />

          {universe.length === 0 ? (
            <EmptyState title={t("charts.page.emptyTitle")} body={t("charts.page.emptyBody")} />
          ) : (
            <ChartWorkbench universe={universe} initialTicker={initialTicker} isAuthenticated={Boolean(userId)} />
          )}
        </div>
        <SiteFooter />
      </AppHeader>
    );
  }

  const catalog = await getChartCatalog();

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("charts.page.kicker")}
          title={t("charts.page.title")}
          lead={t("charts.page.lead")}
        />

        {catalog.entries.length === 0 ? (
          <EmptyState title={t("charts.page.emptyTitle")} body={t("charts.page.emptyBody")} />
        ) : (
          <ChartCatalog catalog={catalog} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
