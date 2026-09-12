import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexDetailClient from "@/components/indices/IndexDetailClient";
import { getMarketIndexDetail } from "@/lib/api/market-indices";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const detail = await getMarketIndexDetail(params.code);
  if (!detail) {
    return { title: "Indice — OuestBourse" };
  }
  return {
    title: `${detail.name} — Indices BRVM — OuestBourse`,
    description: `Historique et indicateurs de ${detail.name}. Les champs absents s’affichent N/D.`,
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
