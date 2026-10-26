import AuthPage from "@/components/auth/AuthPage";
import RegisterForm from "@/components/auth/RegisterForm";
import { enabledOAuthProviderIds } from "@/lib/auth/auth-options";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.register.metaTitle"), description: t("auth.register.metaDescription") };
}

export default function InscriptionPage() {
  const { t } = getI18n();
  return (
    <AuthPage title={t("auth.register.heading")} lead={t("auth.register.lead")}>
      <RegisterForm oauthProviders={enabledOAuthProviderIds} />
    </AuthPage>
  );
}
