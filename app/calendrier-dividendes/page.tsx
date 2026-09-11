// Calendrier des dividendes BRVM — données canoniques (ex / paiement / exercice).
import AppHeader from "@/components/AppHeader";
import DividendCalendarClient from "@/components/dividendes/DividendCalendarClient";
import SiteFooter from "@/components/layout/SiteFooter";
import PageHeader from "@/components/ui/PageHeader";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendrier des dividendes — OuestBourse",
  description:
    "Calendrier des dividendes des sociétés cotées à la BRVM : dates de détachement, mise en paiement et montants par exercice.",
};

export default async function CalendrierDividendesPage() {
  const data = await getDividendCalendarDataset();

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Calendrier"
          title="Calendrier des dividendes"
          lead="Montants et dates de dividendes des sociétés cotées à la BRVM. Si la date de détachement ou de paiement n’est pas connue, elle s’affiche N/D."
        />
        <DividendCalendarClient data={data} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
