import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexDetailClient from "@/components/indices/IndexDetailClient";
import { getMarketIndexDetail } from "@/lib/api/market-indices";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadIndexPage } from "@/lib/markets/index-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const { t } = getI18n();
  const detail = await getMarketIndexDetail(params.code);
  if (!detail) {
    return { title: t("market.indices.fallbackTitle") };
  }
  return {
    title: t("market.indices.detailTitle", { name: detail.name }),
    description: t("market.indices.detailDescription", { name: detail.name }),
  };
}

export default async function IndexDetailPage({ params }: { params: { code: string } }) {
  const data = await loadIndexPage(params.code, "BRVM").catch((err) => {
    if (isDatabaseUnavailable(err)) return null;
    throw err;
  });
  if (!data) notFound();

  return (
    <AppHeader>
      <div className="ob-page">
        <IndexDetailClient data={data} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
