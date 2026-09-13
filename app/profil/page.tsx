import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import ProfileClient from "@/components/profile/ProfileClient";
import NotificationPrefsForm from "@/components/notifications/NotificationPrefsForm";
import profileStyles from "@/components/profile/Profile.module.css";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { C } from "@/lib/theme/colors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mon profil — OuestBourse",
  description: "Gérez votre compte, votre mot de passe et vos préférences d’alertes OuestBourse.",
};

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: { verify?: string };
}) {
  const sessionUser = await getCurrentUser().catch(() => null);
  if (!sessionUser?.id) {
    redirect("/connexion?callbackUrl=/profil");
  }

  let dbUser: {
    name: string | null;
    email: string;
    emailVerified: Date | null;
    passwordHash: string | null;
    role: string;
  } | null = null;

  try {
    if (sessionUser?.id) {
      dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { name: true, email: true, emailVerified: true, passwordHash: true, role: true },
      });
    }
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  const email = dbUser?.email ?? sessionUser?.email ?? "N/D";
  const mailNotice =
    searchParams.verify === "sent"
      ? "Un email de confirmation vient d’être demandé. Consultez votre boîte de réception."
      : null;

  return (
    <AppHeader>
      <div className="ob-page" style={{ paddingBottom: 32 }}>
        <PageHeader
          kicker="Compte"
          title="Mon profil"
          lead="Identité, confirmation d’email, mot de passe et préférences d’alertes — uniquement pour ce compte."
        />
        <ProfileClient
          initial={{
            name: dbUser?.name ?? sessionUser?.name ?? null,
            email,
            emailVerified: dbUser ? Boolean(dbUser.emailVerified) : sessionUser?.emailVerified === true,
            hasPassword: Boolean(dbUser?.passwordHash),
            isAdmin: isAdminRoleOrEmail({
              role: dbUser?.role ?? sessionUser?.role,
              email,
            }),
          }}
          mailNotice={mailNotice}
        />

        <p style={{ margin: "18px 0 0" }}>
          <Link href="/notifications" style={{ color: C.gold, fontWeight: 700, fontSize: "0.84rem" }}>
            Ouvrir le centre de notifications
          </Link>
        </p>

        <div className={profileStyles.alertsWrap} style={{ marginTop: 22 }}>
          <NotificationPrefsForm />
        </div>
      </div>
    </AppHeader>
  );
}
