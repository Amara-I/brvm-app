import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import InvestmentSimulator from "@/components/simulation/InvestmentSimulator";
import PageHeader from "@/components/ui/PageHeader";
import { C } from "@/lib/theme/colors";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulation — OuestBourse",
  description:
    "Simulez l'évolution d'un investissement dans le temps : capital, versements et scénarios de rendement.",
};

export default async function SimulationPage() {
  const preferredPortfolioType = await getPreferredPortfolioType().catch(() => null);
  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Outil pédagogique"
          title="Simulation"
          lead="Projetez le capital et les versements dans le temps selon un rendement annuel hypothétique — scénarios central, optimiste et pessimiste. Changez le type de portefeuille pour relire la même simulation sous un autre angle. Outil pédagogique, pas un conseil d’investissement."
        />
        <InvestmentSimulator preferredPortfolioType={preferredPortfolioType} />
        <p style={{ marginTop: 18, fontSize: "0.86rem", color: C.textDim, lineHeight: 1.5 }}>
          Pour dimensionner une position action (capital, stop, quantité) plutôt qu’une projection de
          versements :{" "}
          <Link href="/outils/taille-position" style={{ color: C.gold, fontWeight: 700 }}>
            calculette taille de position
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
