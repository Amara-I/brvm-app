import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import PositionSizeCalculator from "@/components/outils/PositionSizeCalculator";
import PageHeader from "@/components/ui/PageHeader";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { latestPositivePrice } from "@/lib/calc/position-size";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return {
    title: t("tools.position.metaTitle"),
    description: t("tools.position.metaDescription"),
  };
}

export default async function PositionSizePage({
  searchParams,
}: {
  searchParams?: { ticker?: string; example?: string };
}) {
  const { t, locale } = getI18n();
  const [dataset, userId] = await Promise.all([
    getCompaniesFullDataset(),
    getCurrentUserId().catch(() => null),
  ]);

  const tickers = dataset.companies
    .map((c) => ({
      ticker: c.ticker,
      name: c.name,
      lastPrice: latestPositivePrice(c.prices),
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker, locale === "en" ? "en" : "fr"));

  const example = searchParams?.example === "sogb" || searchParams?.example === "1";

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("tools.position.kicker")}
          title={t("tools.position.title")}
          lead={t("tools.position.lead")}
        />
        <PositionSizeCalculator
          tickers={tickers}
          isAuthenticated={Boolean(userId)}
          initialTicker={searchParams?.ticker}
          loadExample={example}
        />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
