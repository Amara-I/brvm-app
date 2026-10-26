import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexDetailClient from "@/components/indices/IndexDetailClient";
import { getMarketIndexDetail } from "@/lib/api/market-indices";
import { getI18n } from "@/lib/i18n/get-i18n";

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
  const detail = await getMarketIndexDetail(params.code);
  if (!detail) notFound();

  return (
    <AppHeader>
      <div className="ob-page">
        <IndexDetailClient detail={detail} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
