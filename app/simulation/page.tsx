import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import InvestmentSimulator from "@/components/simulation/InvestmentSimulator";
import PageHeader from "@/components/ui/PageHeader";
import { C } from "@/lib/theme/colors";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return {
    title: t("tools.simulation.metaTitle"),
    description: t("tools.simulation.metaDescription"),
  };
}

export default async function SimulationPage() {
  const { t } = getI18n();
  const preferredPortfolioType = await getPreferredPortfolioType().catch(() => null);
  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("tools.simulation.kicker")}
          title={t("tools.simulation.title")}
          lead={t("tools.simulation.lead")}
        />
        <InvestmentSimulator preferredPortfolioType={preferredPortfolioType} />
        <p style={{ marginTop: 18, fontSize: "0.86rem", color: C.textDim, lineHeight: 1.5 }}>
          {t("tools.simulation.cross")}{" "}
          <Link href="/outils/taille-position" style={{ color: C.gold, fontWeight: 700 }}>
            {t("tools.simulation.crossLink")}
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
