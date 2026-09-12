import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytique — Administration — OuestBourse",
  description: "Vue admin des pages et fonctionnalités les plus utilisées.",
};

export default async function AdminAnalyticsPage() {
  const admin = await requireAdmin();
  if (!admin.ok && admin.status === 401) {
    redirect("/connexion?callbackUrl=/admin/analytics");
  }
  if (!admin.ok) {
    return (
      <AppHeader>
        <div className="ob-page">
          <PageHeader
            kicker="Administration"
            title="Accès refusé"
            lead="Cette vue est réservée aux administrateurs."
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
