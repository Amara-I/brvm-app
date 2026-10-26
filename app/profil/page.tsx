import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import ProfileClient from "@/components/profile/ProfileClient";
import NotificationPrefsForm from "@/components/notifications/NotificationPrefsForm";
import profileStyles from "@/components/profile/Profile.module.css";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isAdminRoleOrEmail } from "@/lib/auth/admin-emails";
import { parsePortfolioType } from "@/lib/portfolio-types";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { C } from "@/lib/theme/colors";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.profile.metaTitle"), description: t("auth.profile.metaDescription") };
}

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
    preferredPortfolioType: string | null;
  } | null = null;

  try {
    if (sessionUser?.id) {
      dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          name: true,
          email: true,
          emailVerified: true,
          passwordHash: true,
          role: true,
          preferredPortfolioType: true,
        },
      });
    }
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  const { t } = getI18n();
  const email = dbUser?.email ?? sessionUser?.email ?? "N/D";
  const mailNotice = searchParams.verify === "sent" ? t("auth.profile.verifySent") : null;

  return (
    <AppHeader>
      <div className="ob-page" style={{ paddingBottom: 32 }}>
        <PageHeader kicker={t("auth.kicker")} title={t("auth.profile.heading")} lead={t("auth.profile.lead")} />
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
            preferredPortfolioType: parsePortfolioType(dbUser?.preferredPortfolioType),
          }}
          mailNotice={mailNotice}
        />

        <p style={{ margin: "18px 0 0" }}>
          <Link href="/notifications" style={{ color: C.gold, fontWeight: 700, fontSize: "0.84rem" }}>
            {t("auth.profile.openCenter")}
          </Link>
        </p>

        <div className={profileStyles.alertsWrap}>
          <NotificationPrefsForm />
        </div>
      </div>
    </AppHeader>
  );
}
