import AuthPage from "@/components/auth/AuthPage";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { peekAuthToken } from "@/lib/auth/tokens";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { getI18n } from "@/lib/i18n/get-i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.reset.metaTitle"), description: t("auth.reset.metaDescription") };
}

type Props = {
  searchParams: { token?: string };
};

export default async function ReinitialiserMotDePassePage({ searchParams }: Props) {
  const { t } = getI18n();
  const token = searchParams.token?.trim() ?? "";
  const valid = token.length >= 16 ? await peekAuthToken(token, "PASSWORD_RESET") : null;

  return (
    <AuthPage
      title={t("auth.reset.heading")}
      lead={t("auth.reset.lead", { count: MIN_PASSWORD_LENGTH })}
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p>
          {t("auth.reset.invalid")}{" "}
          <Link href="/mot-de-passe-oublie" style={{ color: "var(--c-gold)" }}>
            {t("auth.reset.requestNew")}
          </Link>
          .
        </p>
      )}
    </AuthPage>
  );
}
