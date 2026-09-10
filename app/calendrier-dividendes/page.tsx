// Calendrier des dividendes BRVM — données canoniques (ex / paiement / exercice).
import AppHeader from "@/components/AppHeader";
import DividendCalendarClient from "@/components/dividendes/DividendCalendarClient";
import SiteFooter from "@/components/layout/SiteFooter";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";

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
      <div>
        <h1 style={PAGE_TITLE}>Calendrier des dividendes</h1>
        <p style={{ ...PAGE_LEAD, maxWidth: 760 }}>
          Montants et dates de dividendes des sociétés cotées à la BRVM. Si la date de détachement ou
          de paiement n&apos;est pas connue, elle s&apos;affiche N/D.
        </p>
        <DividendCalendarClient data={data} />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
