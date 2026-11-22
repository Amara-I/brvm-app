// Page Graphes — workbench unique (actions et indices, BRVM et NGX).
// Sans ticker : ouvre le graphe d'ABJC (ou la première action BRVM).
// La recherche du workbench est alimentée par le catalogue mis en cache
// (`chart-catalog-v1`) : une nouvelle cotation y apparaît automatiquement.
import AppHeader from "@/components/AppHeader";
import ChartWorkbench from "@/components/charts/LazyChartWorkbench";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { getChartCatalog } from "@/lib/charts/chart-catalog";
import {
  catalogToUniverse,
  resolveChartInstrument,
} from "@/lib/charts/chart-selection";
import { getViewer } from "@/lib/entitlements";
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
  searchParams?: { ticker?: string; indice?: string };
}) {
  const { t } = getI18n();
  const catalog = await getChartCatalog();
  const universe = catalogToUniverse(catalog.entries);
  const instrument = resolveChartInstrument(
    { ticker: searchParams?.ticker, indice: searchParams?.indice },
    catalog.entries.filter((entry) => entry.exchange === "BRVM" || entry.exchange === "NGX")
  );
  const viewer = await getViewer();

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("charts.page.kicker")}
          title={t("charts.page.title")}
          lead={t("charts.page.workbenchLead")}
        />

        {universe.length === 0 || !instrument ? (
          <EmptyState title={t("charts.page.emptyTitle")} body={t("charts.page.emptyBody")} />
        ) : (
          <ChartWorkbench
            universe={universe}
            initialTicker={instrument.symbol}
            initialKind={instrument.kind}
            initialExchange={instrument.exchange === "NGX" ? "NGX" : "BRVM"}
            mixedMarkets
            isAuthenticated={Boolean(viewer.userId)}
            gatedVisitor={viewer.gated}
          />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
