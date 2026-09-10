import AppHeader from "@/components/AppHeader";
import EducationHubClient from "@/components/education/EducationHubClient";
import SiteFooter from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Éducation — OuestBourse",
  description:
    "Lexique et guides pour comprendre la BRVM, l'analyse financière et les outils OuestBourse.",
};

export default function EducationPage() {
  return (
    <AppHeader>
      <EducationHubClient />
      <SiteFooter />
    </AppHeader>
  );
}
