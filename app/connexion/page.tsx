import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import LoginForm from "@/components/auth/LoginForm";
import { enabledOAuthProviderIds } from "@/lib/auth/auth-options";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.login.metaTitle"), description: t("auth.login.metaDescription") };
}

export default function ConnexionPage() {
  const { t } = getI18n();
  return (
    <AuthPage title={t("auth.login.heading")} lead={t("auth.login.lead")}>
      <Suspense fallback={null}>
        <LoginForm oauthProviders={enabledOAuthProviderIds} />
      </Suspense>
    </AuthPage>
  );
}
