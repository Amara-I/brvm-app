import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import IndexDetailClient from "@/components/indices/IndexDetailClient";
import NgxChart from "@/components/ngx/NgxChart";
import styles from "@/components/ngx/NgxMarket.module.css";
import PageHeader from "@/components/ui/PageHeader";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadIndexPage } from "@/lib/markets/index-page";
import { loadNgxChartUniverse } from "@/lib/markets/ngx-chart";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const { t } = getI18n();
  const data = await loadIndexPage(params.code, "NGX").catch(() => null);
  if (!data) return { title: t("ngx.indices.metaTitle") };
  return {
    title: `${data.detail.name} — ${t("ngx.indices.title")}`,
    description: t("ngx.indices.metaDescription"),
  };
}

export default async function NgxIndexDetailPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { vue?: string };
}) {
  const { t } = getI18n();
  const code = params.code.toUpperCase();
  const detailed = searchParams?.vue === "graphe";
  const data = await loadIndexPage(code, "NGX").catch((err) => {
    if (isDatabaseUnavailable(err)) return null;
    throw err;
  });
  if (!data) notFound();

  // Graphe détaillé (workbench) : seulement à la demande, pour ne pas lire
  // l'univers et la série complète à chaque visite de la fiche.
  if (detailed) {
    const [chartUniverse, userId] = await Promise.all([
      loadNgxChartUniverse().catch(() => []),
      getCurrentUserId().catch(() => null),
    ]);
    return (
      <AppHeader>
        <div className="ob-page">
          <p>
            <Link className={styles.back} href={`/marches/ngx/indices/${code}`}>
              {t("market.indices.sheet.backToSheet")}
            </Link>
          </p>
          <PageHeader kicker={`NGX · ${code.replace(/_/g, " ")}`} title={data.detail.name} />
          <NgxChart symbol={code} universe={chartUniverse} isAuthenticated={Boolean(userId)} />
        </div>
        <SiteFooter />
      </AppHeader>
    );
  }

  return (
    <AppHeader>
      <div className="ob-page">
        <IndexDetailClient
          data={data}
          backHref="/marches/ngx/indices"
          backLabel={`← ${t("ngx.indices.detailBack")}`}
          stockHrefPrefix="/marches/ngx/actions/"
          extraHeader={
            data.detail.series.length > 1 ? (
              <Link className={styles.back} href={`/marches/ngx/indices/${code}?vue=graphe`}>
                {t("market.indices.sheet.detailedChart")} →
              </Link>
            ) : null
          }
        />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
