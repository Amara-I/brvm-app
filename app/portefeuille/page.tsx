// Page "Portefeuille" — étape 16 (démo premium + KPI connectés).
import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";
import { prisma } from "@/lib/prisma";
import PortfolioPageClient from "@/components/portfolio/PortfolioPageClient";
import PortfolioAllocationChart from "@/components/portfolio/PortfolioAllocationChart";
import {
  AllocationBars,
  Kpi,
  panelStyle,
  allocationLayoutRow,
  allocationSectorsCol,
  allocationTickersCol,
} from "@/components/portfolio/PortfolioPageParts";
import { listPortfolioTrades, summarizeRealizedPnl, ensureOpeningTrades } from "@/lib/api/portfolio-trades";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return {
    title: t("portfolio.meta.title"),
    description: t("portfolio.meta.description"),
  };
}

function GuestDemo() {
  const { t, format } = getI18n();
  const demoKpis = [
    { l: t("portfolio.guest.total"), v: format.fcfa(12_450_000), edu: "valeur-de-marche" as const },
    { l: t("portfolio.guest.latent"), v: format.percent(8.4, 1, true), edu: "plus-moins-value-latente" as const },
    { l: t("portfolio.guest.pru"), v: format.fcfa(18_200), edu: "pru" as const },
    { l: t("portfolio.guest.dividends"), v: format.fcfa(245_000), edu: "performance-ytd" as const },
  ];
  const demoAlloc = [
    { sector: "Télécoms", weightPercent: 42 },
    { sector: "Banques", weightPercent: 33 },
    { sector: "Industrie", weightPercent: 25 },
  ];

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker={t("portfolio.guest.kicker")}
          title={t("portfolio.guest.title")}
          lead={t("portfolio.guest.lead")}
        />

        <div className="ob-card ob-card-pad" style={{ marginBottom: 18, textAlign: "center" }}>
          <strong style={{ color: C.text, fontSize: "var(--fs-body-sm)" }}>{t("portfolio.guest.illustrative")}</strong>
          <p style={{ color: C.textDim, fontSize: "var(--fs-body-sm)", margin: "6px 0 0" }}>
            {t("portfolio.guest.illustrativeBody")}
          </p>
        </div>

        <div className="ob-kpi-grid" style={{ marginBottom: 16 }}>
          {demoKpis.map((k) => (
            <Kpi key={k.l} label={k.l} value={k.v} educationSlug={k.edu} />
          ))}
        </div>

        <div style={panelStyle} data-align-left>
          <div style={allocationLayoutRow}>
            <div style={allocationSectorsCol}>
              <AllocationBars items={demoAlloc} />
            </div>
            <div style={allocationTickersCol}>
              <PortfolioAllocationChart
                items={[
                  { ticker: "SNTS", sector: "Télécoms", value: 5229000, weightPercent: 42 },
                  { ticker: "SGBC", sector: "Banques", value: 4108500, weightPercent: 33 },
                  { ticker: "SDSC", sector: "Industrie", value: 3112500, weightPercent: 25 },
                ]}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <Link href="/connexion" className="ob-btn-secondary">
              {t("chrome.auth.login")}
            </Link>
            <Link href="/inscription" className="ob-btn-gold">
              {t("chrome.auth.register")}
            </Link>
          </div>
        </div>
      </div>
    </AppHeader>
  );
}

export default async function PortefeuillePage() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) return <GuestDemo />;

  let portfolios: Awaited<ReturnType<typeof getUserPortfoliosWithMetrics>>;
  let tickers: string[];
  try {
    const [loaded, companies] = await Promise.all([
      getUserPortfoliosWithMetrics(user.id),
      prisma.company.findMany({ where: { isActive: true }, select: { ticker: true }, orderBy: { ticker: "asc" } }),
    ]);
    portfolios = loaded;
    tickers = companies.map((c) => c.ticker);
  } catch (err) {
    console.error("[portefeuille] lecture base impossible — aperçu invité :", err);
    return <GuestDemo />;
  }

  const tradesByPortfolio: Record<
    string,
    { trades: Awaited<ReturnType<typeof listPortfolioTrades>>; summary: ReturnType<typeof summarizeRealizedPnl> }
  > = {};

  await Promise.all(
    portfolios.map(async (p) => {
      try {
        await ensureOpeningTrades(prisma, p.id);
        const trades = await listPortfolioTrades(prisma, p.id, { take: 200 });
        tradesByPortfolio[p.id] = { trades, summary: summarizeRealizedPnl(trades) };
      } catch (err) {
        console.error(`[portefeuille] historique trades ${p.id}`, err);
        tradesByPortfolio[p.id] = {
          trades: [],
          summary: { totalRealizedPnl: 0, salesCount: 0, lossCount: 0, gainCount: 0 },
        };
      }
    })
  );

  return (
    <AppHeader>
      <PortfolioPageClient
        initialPortfolios={portfolios}
        tickers={tickers}
        tradesByPortfolio={tradesByPortfolio}
      />
    </AppHeader>
  );
}
