import Link from "next/link";
import { redirect } from "next/navigation";
import AuthPage from "@/components/auth/AuthPage";
import { verifyEmailWithToken } from "@/lib/auth/verify-email";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.verify.metaTitle"), description: t("auth.verify.metaDescription") };
}

type Props = {
  searchParams: { token?: string };
};

export default async function VerifierEmailPage({ searchParams }: Props) {
  const { t } = getI18n();
  const result = await verifyEmailWithToken(searchParams.token);

  if (result.ok) {
    redirect("/connexion?verified=1");
  }

  return (
    <AuthPage title={t("auth.verify.heading")} lead={t("auth.verify.lead")}>
      <p style={{ margin: "0 0 12px", color: "var(--c-text)" }}>{t("auth.verify.invalidBody")}</p>
      <p style={{ margin: 0 }}>
        <Link href="/connexion" style={{ color: "var(--c-gold)" }}>
          {t("auth.verify.goToLogin")}
        </Link>
      </p>
    </AuthPage>
  );
}
