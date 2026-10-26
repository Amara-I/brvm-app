import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.analytics.metaTitle"), description: t("auth.analytics.metaDescription") };
}

export default async function AdminAnalyticsPage() {
  const { t } = getI18n();
  const admin = await requireAdmin();
  if (!admin.ok && admin.status === 401) {
    redirect("/connexion?callbackUrl=/admin/analytics");
  }
  if (!admin.ok) {
    return (
      <AppHeader>
        <div className="ob-page">
          <PageHeader
            kicker={t("auth.analytics.kicker")}
            title={t("auth.analytics.deniedTitle")}
            lead={t("auth.analytics.deniedLead")}
          />
        </div>
      </AppHeader>
    );
  }

  return (
    <AppHeader>
      <AnalyticsDashboard />
    </AppHeader>
  );
}
