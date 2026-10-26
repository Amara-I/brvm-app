import AuthPage from "@/components/auth/AuthPage";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.forgot.metaTitle"), description: t("auth.forgot.metaDescription") };
}

export default function MotDePasseOubliePage() {
  const { t } = getI18n();
  return (
    <AuthPage title={t("auth.forgot.heading")} lead={t("auth.forgot.lead")}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
