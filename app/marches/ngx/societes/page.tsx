import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import NgxListedCompaniesTable, {
  type NgxListedCompaniesTableRow,
} from "@/components/ngx/NgxListedCompaniesTable";
import local from "@/components/ngx/NgxListedCompanies.module.css";
import styles from "@/components/ngx/NgxMarket.module.css";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { keepNumbersTogether } from "@/lib/text/no-break";
import { loadNgxListedCompanies } from "@/lib/markets/ngx-listed-companies";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("ngx.listed.metaTitle"), description: t("ngx.listed.metaDescription") };
}

export default async function NgxListedCompaniesPage({
  searchParams,
}: {
  searchParams?: { secteur?: string };
}) {
  const { t, format } = getI18n();
  const data = await loadNgxListedCompanies().catch(() => null);
  const rows: NgxListedCompaniesTableRow[] = (data?.rows ?? []).map((row) => ({
    ...row,
    sectorLabel: row.category,
  }));
  const initialSector = typeof searchParams?.secteur === "string" ? searchParams.secteur : "";
  const sessionLabel = data?.sessionDate
    ? format.date(data.sessionDate, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : t("common.nd");
  const capLabel =
    data?.totalCapBn != null
      ? keepNumbersTogether(t("market.capCurrency", { amount: format.number(data.totalCapBn), currency: "₦" }))
      : t("common.nd");

  return (
    <AppHeader>
      <div className="ob-page">
        <Link href="/marches/ngx" className={local.back}>
          ← {t("ngx.listed.back")}
        </Link>
        <PageHeader kicker={t("ngx.listed.kicker")} title={t("ngx.listed.title")} lead={t("ngx.listed.lead")} />
        {rows.length > 0 && data ? (
          <>
            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <span>{t("ngx.listed.kpiListed")}</span>
                <strong>{keepNumbersTogether(format.integer(data.rows.length))}</strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.listed.kpiSectors")}</span>
                <strong>{keepNumbersTogether(format.integer(data.sectors.length))}</strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.listed.kpiSession")}</span>
                <strong>{keepNumbersTogether(sessionLabel)}</strong>
              </div>
              <div className={styles.kpi}>
                <span>{t("ngx.listed.kpiCap")}</span>
                <strong>{capLabel}</strong>
              </div>
            </div>
            <NgxListedCompaniesTable rows={rows} sectors={data.sectors} initialSector={initialSector} />
            <p className={local.note}>{t("ngx.listed.note", { date: sessionLabel })}</p>
            <p className={local.disclaimer}>{t("ngx.listed.disclaimer")}</p>
          </>
        ) : (
          <EmptyState title={t("ngx.listed.emptyTitle")} body={t("ngx.listed.emptyBody")} />
        )}
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
