// Page "Portefeuille" — étape 16 (démo premium + KPI connectés).
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { HERO_TITLE, PAGE_LEAD } from "@/lib/theme/typography";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";
import { prisma } from "@/lib/prisma";
import PortfolioPageClient from "@/components/portfolio/PortfolioPageClient";
import PortfolioAllocationChart from "@/components/portfolio/PortfolioAllocationChart";
import { AllocationBars, Kpi, panelStyle, allocationLayoutRow, allocationSectorsCol, allocationTickersCol } from "@/components/portfolio/PortfolioPageParts";
import { listPortfolioTrades, summarizeRealizedPnl, ensureOpeningTrades } from "@/lib/api/portfolio-trades";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Portefeuille — OuestBourse",
  description: "Suivez la valeur, la performance et la répartition sectorielle de votre portefeuille BRVM.",
};

function GuestDemo() {
  const demoKpis = [
    { l: "Total du portefeuille", v: "12 450 000 FCFA", edu: "valeur-de-marche" as const },
    { l: "Plus-value latente", v: "+8,4 %", edu: "plus-moins-value-latente" as const },
    { l: "PRU moyen", v: "18 200 FCFA", edu: "pru" as const },
    { l: "Dividendes YTD", v: "245 000 FCFA", edu: "performance-ytd" as const },
  ];
  const demoAlloc = [
    { sector: "Télécoms", weightPercent: 42 },
    { sector: "Banques", weightPercent: 33 },
    { sector: "Industrie", weightPercent: 25 },
  ];

  return (
    <AppHeader>
      <div>
        <h1 style={HERO_TITLE}>Portefeuille</h1>
        <p style={PAGE_LEAD}>
          Suivez la valorisation, la performance latente et l&apos;allocation de vos positions BRVM. Connectez-vous pour
          enregistrer un portefeuille réel.
        </p>

        <div style={{ ...panelStyle, marginBottom: 18, textAlign: "center" }}>
          <strong style={{ color: C.text, fontSize: "var(--fs-body-sm)" }}>Chiffres illustratifs</strong>
          <p style={{ color: C.textDim, fontSize: "var(--fs-body-sm)", margin: "6px 0 0" }}>
            L&apos;aperçu ci-dessous est une démonstration visuelle — ce ne sont pas vos positions ni des cours live.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" }}>
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
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22, justifyContent: "center" }}>
            <Link
              href="/connexion"
              style={{
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "10px 18px",
                textDecoration: "none",
                fontSize: "var(--fs-body-sm)",
                fontWeight: 600,
              }}
            >
              Connexion
            </Link>
            <Link
              href="/inscription"
              style={{
                color: "#080B12",
                background: C.gold,
                fontWeight: 700,
                borderRadius: 10,
                padding: "10px 18px",
                textDecoration: "none",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              Créer un compte
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
