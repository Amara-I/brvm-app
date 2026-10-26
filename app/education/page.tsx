import AppHeader from "@/components/AppHeader";
import EducationHubClient from "@/components/education/EducationHubClient";
import SiteFooter from "@/components/layout/SiteFooter";
import { getI18n } from "@/lib/i18n/get-i18n";

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("education.metaTitle"),
    description: t("education.metaDescription"),
  };
}

export default function EducationPage() {
  return (
    <AppHeader>
      <EducationHubClient />
      <SiteFooter />
    </AppHeader>
  );
}
