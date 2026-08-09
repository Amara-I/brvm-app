// Page "Portefeuille" — étape 10 (navigation complète).
// Réutilise l'authentification + les métriques de portefeuille de l'étape 7
// (`getUserPortfoliosWithMetrics`, la MÊME fonction que `GET /api/portfolio`,
// validée de bout en bout contre une vraie base le 09/08/2026).
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getUserPortfoliosWithMetrics } from "@/lib/api/portfolio-data";
import { prisma } from "@/lib/prisma";
import CreatePortfolioButton from "@/components/portfolio/CreatePortfolioButton";
import AddHoldingForm from "@/components/portfolio/AddHoldingForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portefeuille — BRVM App",
  description: "Suivez la valeur, la performance et la répartition sectorielle de votre portefeuille BRVM.",
};

const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 };

function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export default async function PortefeuillePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
        <AppHeader />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
          <h1 style={{ color: C.text, fontSize: "1.4rem" }}>💼 Portefeuille</h1>
          <p style={{ color: C.textDim, fontSize: "0.9rem", marginBottom: 24 }}>
            Connectez-vous pour suivre la valeur, la plus-value et la répartition sectorielle de votre portefeuille BRVM.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/connexion" style={{ color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 18px", textDecoration: "none", fontSize: "0.85rem" }}>
              Connexion
            </Link>
            <Link href="/inscription" style={{ color: "#080B12", background: C.gold, fontWeight: 700, borderRadius: 6, padding: "9px 18px", textDecoration: "none", fontSize: "0.85rem" }}>
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [portfolios, companies] = await Promise.all([
    getUserPortfoliosWithMetrics(user.id),
    prisma.company.findMany({ where: { isActive: true }, select: { ticker: true }, orderBy: { ticker: "asc" } }),
  ]);
  const tickers = companies.map((c) => c.ticker);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ color: C.text, fontSize: "1.4rem", margin: 0 }}>💼 Mon portefeuille</h1>
          <CreatePortfolioButton />
        </div>

        {portfolios.length === 0 && (
          <div style={panelStyle}>
            <p style={{ color: C.textDim, fontSize: "0.88rem", margin: 0 }}>
              Vous n&apos;avez pas encore de portefeuille. Cliquez sur « + Nouveau portefeuille » pour commencer à suivre vos
              positions BRVM.
            </p>
          </div>
        )}

        {portfolios.map((p) => (
          <div key={p.id} style={panelStyle}>
            <h2 style={{ color: C.gold, fontSize: "1.05rem", marginTop: 0, marginBottom: 14 }}>{p.name}</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ flex: "1 1 160px" }}>
                <div style={{ color: C.textDim, fontSize: "0.68rem", textTransform: "uppercase" }}>Valeur de marché</div>
                <div style={{ color: C.text, fontSize: "1.15rem", fontWeight: 700 }}>{fmtFcfa(p.metrics.totalMarketValue)}</div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div style={{ color: C.textDim, fontSize: "0.68rem", textTransform: "uppercase" }}>Plus/moins-value</div>
                <div style={{ color: p.metrics.totalGainLoss >= 0 ? C.green : C.red, fontSize: "1.15rem", fontWeight: 700 }}>
                  {p.metrics.totalGainLoss >= 0 ? "+" : ""}
                  {fmtFcfa(p.metrics.totalGainLoss)}{" "}
                  {p.metrics.totalGainLossPercent !== "N/D" ? `(${p.metrics.totalGainLossPercent}%)` : ""}
                </div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div style={{ color: C.textDim, fontSize: "0.68rem", textTransform: "uppercase" }}>Performance YTD</div>
                <div style={{ color: C.teal, fontSize: "1.15rem", fontWeight: 700 }}>
                  {p.metrics.ytdChangePercent !== "N/D" ? `${p.metrics.ytdChangePercent}%` : "N/D"}
                </div>
              </div>
            </div>

            {p.holdings.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ color: C.textDim, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>
                    <th scope="col" style={{ padding: "6px 4px" }}>Société</th>
                    <th scope="col" style={{ padding: "6px 4px" }}>Qté</th>
                    <th scope="col" style={{ padding: "6px 4px" }}>PRU</th>
                    <th scope="col" style={{ padding: "6px 4px" }}>Valeur</th>
                    <th scope="col" style={{ padding: "6px 4px" }}>+/-value</th>
                  </tr>
                </thead>
                <tbody>
                  {p.metrics.holdings.map((h) => (
                    <tr key={h.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 4px", color: C.text }}>{h.ticker}</td>
                      <td style={{ padding: "6px 4px", color: C.text }}>{h.quantity}</td>
                      <td style={{ padding: "6px 4px", color: C.text }}>{fmtFcfa(h.avgBuyPrice)}</td>
                      <td style={{ padding: "6px 4px", color: C.text }}>{typeof h.marketValue === "number" ? fmtFcfa(h.marketValue) : "N/D"}</td>
                      <td style={{ padding: "6px 4px", color: typeof h.gainLoss === "number" && h.gainLoss >= 0 ? C.green : C.red }}>
                        {typeof h.gainLossPercent === "number" ? `${h.gainLossPercent >= 0 ? "+" : ""}${h.gainLossPercent}%` : "N/D"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: C.textDim, fontSize: "0.82rem" }}>Aucune position pour l&apos;instant — ajoutez-en une ci-dessous.</p>
            )}

            <AddHoldingForm portfolioId={p.id} tickers={tickers} />
          </div>
        ))}
      </div>
    </div>
  );
}
