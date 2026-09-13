import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { getCurrentUserId } from "@/lib/auth/get-current-user";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — OuestBourse",
  description: "Centre de notifications : alertes de prix, signaux, portefeuille et indices BRVM.",
};

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
