// Fiche société dédiée — layout premium (étape 20).
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CompanySheetClient from "@/components/actions/CompanySheetClient";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { getPreferredPortfolioType } from "@/lib/auth/preferred-portfolio-type";
import { normalizeSheetTab } from "@/lib/ui/company-sheet-tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { ticker: string };
}

export async function generateMetadata({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();
  return {
    title: `${ticker} — Fiche société · OuestBourse`,
    description: `Cours, performances, santé financière et dividendes pour ${ticker} à la BRVM.`,
  };
}

export default async function CompanyActionPage({
  params,
  searchParams,
}: PageProps & { searchParams?: { tab?: string } }) {
  const ticker = params.ticker.toUpperCase();
  const [payload, userId, preferredPortfolioType] = await Promise.all([
    getCompanySheetPayload(ticker),
    getCurrentUserId().catch(() => null),
    getPreferredPortfolioType().catch(() => null),
  ]);
  if (!payload) notFound();

  const initialTab = searchParams?.tab ? normalizeSheetTab(searchParams.tab) : undefined;

  return (
    <AppHeader>
      <CompanySheetClient
        payload={payload}
        isAuthenticated={Boolean(userId)}
        initialTab={initialTab}
        preferredPortfolioType={preferredPortfolioType}
      />
      <SiteFooter />
    </AppHeader>
  );
}
