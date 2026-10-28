import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import NgxChart from "@/components/ngx/NgxChart";
import styles from "@/components/ngx/NgxMarket.module.css";
import ChangeValue from "@/components/ui/ChangeValue";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxIndex } from "@/lib/markets/ngx-browse";
import { loadNgxChartUniverse } from "@/lib/markets/ngx-chart";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const { t } = getI18n();
  const index = await loadNgxIndex(params.code).catch(() => null);
  if (!index) return { title: t("ngx.indices.metaTitle") };
  return {
    title: `${index.name} — ${t("ngx.indices.title")}`,
    description: t("ngx.indices.metaDescription"),
  };
}

export default async function NgxIndexDetailPage({ params }: { params: { code: string } }) {
  const { t, format } = getI18n();
  const [index, chartUniverse] = await Promise.all([
    loadNgxIndex(params.code).catch(() => null),
    loadNgxChartUniverse().catch(() => []),
  ]);
  if (!index) notFound();

  return (
    <AppHeader>
      <div className="ob-page">
        <p>
          <a className={styles.back} href="/marches/ngx/indices">
            ← {t("ngx.indices.detailBack")}
          </a>
        </p>
        <PageHeader
          kicker={index.code.replace(/_/g, " ")}
          title={index.name}
          lead={t("ngx.market.sourceLine", { source: translateDataSourceLabel(index.sourceLabel, t) })}
        />
        <div className={styles.hero}>
          <div>
            <span className={styles.sub}>{t("market.indices.col.last")}</span>
            <div className={styles.heroPrice}>{index.value == null ? "N/D" : format.decimal(index.value, 2)}</div>
            <ChangeValue value={index.changePercent} />
          </div>
          <div>
            <span className={styles.sub}>{t("ngx.company.session")}</span>
            <div className={styles.heroPrice} style={{ fontSize: "1.2rem" }}>
              {index.date
                ? format.date(`${index.date}T00:00:00.000Z`, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : "N/D"}
            </div>
          </div>
        </div>
        {index.series.length > 1 ? (
          <NgxChart symbol={index.code} universe={chartUniverse} />
        ) : (
          <p className={styles.note}>{t("ngx.indices.chartEmpty")}</p>
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
