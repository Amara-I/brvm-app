import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import NotificationPrefsForm from "@/components/notifications/NotificationPrefsForm";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { C } from "@/lib/theme/colors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profil et alertes — OuestBourse",
  description: "Compte, préférences de notification et canaux d'alerte OuestBourse.",
};

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect("/connexion?callbackUrl=/profil");
  }

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Compte"
          title="Profil"
          lead="Identité du compte et réglages des alertes (in-app, e-mail, heures calmes)."
        />

        <section
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 18,
          }}
        >
          <p style={{ margin: "0 0 4px", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textDim }}>
            Compte
          </p>
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: C.text }}>{user.name ?? "N/D"}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.86rem", color: C.textDim }}>{user.email ?? "N/D"}</p>
          <p style={{ margin: "12px 0 0" }}>
            <Link href="/notifications" style={{ color: C.gold, fontWeight: 700, fontSize: "0.84rem" }}>
              Ouvrir le centre de notifications
            </Link>
          </p>
        </section>

        <NotificationPrefsForm />
      </div>
    </AppHeader>
  );
}
