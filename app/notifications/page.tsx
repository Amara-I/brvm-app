import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("notifications.metaTitle"), description: t("notifications.metaDescription") };
}

export default async function NotificationsPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/connexion?callbackUrl=/notifications");
  }

  return (
    <AppHeader>
      <NotificationCenter />
    </AppHeader>
  );
}
