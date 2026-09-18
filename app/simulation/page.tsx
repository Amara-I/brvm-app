import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import InvestmentSimulator from "@/components/simulation/InvestmentSimulator";
import PageHeader from "@/components/ui/PageHeader";
import { C } from "@/lib/theme/colors";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getUserPortfolioType } from "@/lib/auth/get-user-portfolio-type";
import { PORTFOLIO_TYPE_EDUCATION_HREF } from "@/lib/portfolio/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Simulation — OuestBourse",
  description:
    "Simulez l'évolution d'un investissement selon un type de portefeuille (Croissance, Rente, Trading, Croissance Max) : capital, versements et scénarios de rendement.",
};

export default async function SimulationPage() {
  const userId = await getCurrentUserId().catch(() => null);
  const savedPortfolioType = await getUserPortfolioType(userId).catch(() => null);

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Outil pédagogique"
          title="Simulation"
          lead="Projetez le capital et les versements dans le temps selon un rendement annuel hypothétique — scénarios central, optimiste et pessimiste. Le type de portefeuille change les hypothèses par défaut et le cadrage du risque, pas un conseil d’investissement."
        />
        <InvestmentSimulator
          savedPortfolioType={savedPortfolioType}
          isAuthenticated={Boolean(userId)}
        />
        <p style={{ marginTop: 18, fontSize: "0.86rem", color: C.textDim, lineHeight: 1.5 }}>
          Cadres pédagogiques :{" "}
          <Link href={PORTFOLIO_TYPE_EDUCATION_HREF} style={{ color: C.gold, fontWeight: 700 }}>
            types de portefeuille
          </Link>
          . Pour dimensionner une position action (capital, stop, quantité) plutôt qu’une projection de
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
