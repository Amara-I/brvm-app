import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import InvestmentSimulator from "@/components/simulation/InvestmentSimulator";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulation — OuestBourse",
  description:
    "Simulez l'évolution d'un investissement dans le temps : capital, versements et scénarios de rendement.",
};

export default function SimulationPage() {
  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Outil pédagogique"
          title="Simulation"
          lead="Projetez le capital et les versements dans le temps selon un rendement annuel hypothétique — scénarios central, optimiste et pessimiste. Outil pédagogique, pas un conseil d’investissement."
        />
        <InvestmentSimulator />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
