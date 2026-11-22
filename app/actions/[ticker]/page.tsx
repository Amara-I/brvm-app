// Fiche société dédiée — layout premium (étape 20).
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CompanySheetClient from "@/components/actions/CompanySheetClient";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";
import { getWatchedTickersForCurrentUser } from "@/lib/watchlist/load-watched-tickers";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";
import { getViewer, presentCompanySheetPayload } from "@/lib/entitlements";
import { getI18n } from "@/lib/i18n/get-i18n";
import { normalizeSheetTab } from "@/lib/ui/company-sheet-tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { ticker: string };
}

export async function generateMetadata({ params }: PageProps) {
  const { t } = getI18n();
  const ticker = params.ticker.toUpperCase();
  return {
    title: t("company.meta.title", { ticker }),
    description: t("company.meta.description", { ticker }),
  };
}

export default async function CompanyActionPage({
  params,
  searchParams,
}: PageProps & { searchParams?: { tab?: string } }) {
  const ticker = params.ticker.toUpperCase();
  const [rawPayload, viewer, preferredPortfolioType, watchedTickers] = await Promise.all([
    getCompanySheetPayload(ticker),
    getViewer(),
    getPreferredPortfolioType().catch(() => null),
    getWatchedTickersForCurrentUser().catch(() => null),
  ]);
  if (!rawPayload) notFound();
  const payload = presentCompanySheetPayload(rawPayload, viewer);

  const initialTab = searchParams?.tab ? normalizeSheetTab(searchParams.tab) : undefined;

  return (
    <AppHeader>
      <CompanySheetClient
        payload={payload}
        isAuthenticated={Boolean(viewer.userId)}
        isWatched={watchedTickers?.includes(ticker) ?? false}
        gatedVisitor={viewer.gated}
        initialTab={initialTab}
        preferredPortfolioType={preferredPortfolioType}
      />
      <SiteFooter />
    </AppHeader>
  );
}
