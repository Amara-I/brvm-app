import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import NgxOverviewClient from "@/components/ngx/NgxOverviewClient";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxOverviewBoard } from "@/lib/markets/load-ngx-overview-board";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.market.metaTitle"), description: t("ngx.market.metaDescription") };
}

export default async function NgxMarketPage() {
  const { t } = getI18n();
  // Score, signal technique et variation : mêmes chiffres que le screener et la fiche.
  // Si un chargement échoue, la vue reste affichée avec N/D plutôt que de casser la page.
  const initial = await loadNgxOverviewBoard(t);
  return (
    <AppHeader>
      <NgxOverviewClient initial={initial} />
      <SiteFooter />
    </AppHeader>
  );
}
