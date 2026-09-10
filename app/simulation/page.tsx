import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import InvestmentSimulator from "@/components/simulation/InvestmentSimulator";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulation — OuestBourse",
  description:
    "Simulez l'évolution d'un investissement dans le temps : capital, versements et scénarios de rendement.",
};

export default function SimulationPage() {
  return (
    <AppHeader>
      <div>
        <h1 style={PAGE_TITLE}>Simulation</h1>
        <p style={PAGE_LEAD}>
          Projetez le capital et les versements dans le temps selon un rendement annuel hypothétique —
          scénarios central, optimiste et pessimiste. Outil pédagogique, pas un conseil
          d&apos;investissement.
        </p>
        <InvestmentSimulator />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
