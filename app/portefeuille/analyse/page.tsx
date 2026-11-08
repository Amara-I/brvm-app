import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PageHeader from "@/components/ui/PageHeader";
import PortfolioAnalysisView from "@/components/portfolio/PortfolioAnalysisView";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadUserAnalyses } from "@/lib/portfolio-analysis/load";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return {
    title: t("portfolio.analysis.metaTitle"),
    description: t("portfolio.analysis.metaDescription"),
  };
}

export default async function PortfolioAnalysisPage() {
  const { t } = getI18n();
  const user = await getCurrentUser().catch(() => null);

  if (!user?.id) {
    return (
      <AppHeader>
        <div className="ob-page">
          <PageHeader
            kicker={t("portfolio.analysis.kicker")}
            title={t("portfolio.analysis.loginTitle")}
            lead={t("portfolio.analysis.loginBody")}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/connexion?callbackUrl=/portefeuille/analyse" className="ob-btn-gold">
              {t("chrome.auth.login")}
            </Link>
            <Link href="/inscription" className="ob-btn-secondary">
              {t("chrome.auth.register")}
            </Link>
            <Link href="/education/taille-position" className="ob-btn-secondary">
              {t("portfolio.analysis.education")}
            </Link>
          </div>
        </div>
      </AppHeader>
    );
  }

  try {
    const loaded = await loadUserAnalyses(user.id);
    return (
      <AppHeader>
        <div className="ob-page" style={{ paddingBottom: 32 }}>
          <PageHeader
            kicker={t("portfolio.analysis.kicker")}
            title={t("portfolio.analysis.title")}
            lead={t("portfolio.analysis.lead")}
          />
          <PortfolioAnalysisView analyses={loaded.analyses} profileTableReady={loaded.profileTableReady} />
        </div>
      </AppHeader>
    );
  } catch (err) {
    console.error("[portefeuille/analyse]", err);
    return (
      <AppHeader>
        <div className="ob-page">
          <PageHeader kicker={t("portfolio.analysis.kicker")} title={t("portfolio.analysis.title")} />
          <p style={{ color: "var(--c-textdim)" }}>{t("portfolio.analysis.unavailable")}</p>
        </div>
      </AppHeader>
    );
  }
}
