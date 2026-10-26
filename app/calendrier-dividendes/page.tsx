// Calendrier des dividendes BRVM — données canoniques (ex / paiement / exercice).
import AppHeader from "@/components/AppHeader";
import DividendCalendarClient from "@/components/dividendes/DividendCalendarClient";
import SiteFooter from "@/components/layout/SiteFooter";
import PageHeader from "@/components/ui/PageHeader";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("market.dividends.metaTitle"),
    description: t("market.dividends.metaDescription"),
  };
}

export default async function CalendrierDividendesPage() {
  const { t } = getI18n();
  const data = await getDividendCalendarDataset();

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("market.dividends.kicker")}
          title={t("market.dividends.title")}
          lead={t("market.dividends.lead")}
        />
        <DividendCalendarClient data={data} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
