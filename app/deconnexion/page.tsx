import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import SignOutClient from "./SignOutClient";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const { t } = getI18n();
  return { title: t("auth.signOut.metaTitle"), description: t("auth.signOut.metaDescription") };
}

export default function DeconnexionPage() {
  const { t } = getI18n();
  return (
    <AuthPage title={t("auth.signOut.heading")} lead={t("auth.signOut.lead")}>
      <Suspense fallback={<p>{t("auth.signOut.pending")}</p>}>
        <SignOutClient />
      </Suspense>
    </AuthPage>
  );
}
