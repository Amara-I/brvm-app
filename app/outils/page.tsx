// Page "Outils" — étape 10 (navigation complète).
// Regroupe les outils déjà réels (Export Excel) et les suggestions de
// l'agent de recherche IA permanent (§ 10.2, AGENTS.md). État honnête : la
// liste des trouvailles est vide tant que `RESEARCH_AGENT_ENABLED` et une
// clé de recherche ne sont pas configurés (cf. lib/research/provider-factory.ts).
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Outils — ouestBourse",
  description: "Export de données, alertes et suggestions d'amélioration issues de la veille automatisée ouestBourse.",
};

const CATEGORY_LABELS: Record<string, string> = {
  UX: "🎨 Expérience utilisateur",
  CONTENU: "📰 Contenu & actualités",
  FONCTIONNALITE: "🧩 Fonctionnalité",
  CONCURRENCE: "🔎 Veille concurrentielle",
};

function panel(): React.CSSProperties {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 };
}

export default async function OutilsPage() {
  const findings = await prisma.researchFinding.findMany({
    orderBy: { discoveredAt: "desc" },
    take: 20,
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ color: C.text, fontSize: "1.4rem", marginBottom: 4 }}>🧰 Outils</h1>
        <p style={{ color: C.textDim, fontSize: "0.85rem", marginBottom: 24 }}>
          Export de données et suggestions d&apos;amélioration issues de la veille automatisée.
        </p>

        <div style={panel()}>
          <h2 style={{ color: C.gold, fontSize: "1rem", marginTop: 0, marginBottom: 10 }}>📤 Export Excel</h2>
          <p style={{ color: C.textDim, fontSize: "0.85rem", marginBottom: 12 }}>
            Exportez les données BRVM, projections et classements au format Excel (3 feuilles).
          </p>
          <a
            href="/api/export/excel"
            style={{ display: "inline-block", background: C.green, color: "#080B12", fontWeight: 700, borderRadius: 6, padding: "8px 16px", textDecoration: "none", fontSize: "0.82rem" }}
          >
            ↓ Télécharger le fichier Excel
          </a>
        </div>

        <div style={panel()}>
          <h2 style={{ color: C.gold, fontSize: "1rem", marginTop: 0, marginBottom: 4 }}>🕵️ Suggestions de l&apos;agent de recherche IA</h2>
          <p style={{ color: C.textDim, fontSize: "0.8rem", marginBottom: 14 }}>
            Un agent permanent scanne le web (UX, actualités BRVM, fonctionnalités, veille concurrentielle) pour proposer des pistes
            d&apos;amélioration — jamais appliquées automatiquement, toujours revues manuellement.
          </p>

          {findings.length === 0 ? (
            <p style={{ color: C.textDim, fontSize: "0.82rem", fontStyle: "italic" }}>
              Aucune suggestion pour l&apos;instant — l&apos;agent est désactivé par défaut (
              <code style={{ color: C.silver }}>RESEARCH_AGENT_ENABLED=false</code>) tant qu&apos;une clé de recherche
              (<code style={{ color: C.silver }}>RESEARCH_SEARCH_API_KEY</code>) n&apos;est pas configurée.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {findings.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, textDecoration: "none" }}
                >
                  <div style={{ color: C.textDim, fontSize: "0.68rem", marginBottom: 4 }}>
                    {CATEGORY_LABELS[f.category] ?? f.category} · {new Date(f.discoveredAt).toLocaleDateString("fr-FR")}
                  </div>
                  <div style={{ color: C.text, fontSize: "0.86rem", fontWeight: 700 }}>{f.title}</div>
                  {f.summary && <div style={{ color: C.textDim, fontSize: "0.78rem", marginTop: 2 }}>{f.summary}</div>}
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={panel()}>
          <h2 style={{ color: C.gold, fontSize: "1rem", marginTop: 0, marginBottom: 10 }}>🔜 Bientôt disponible</h2>
          <ul style={{ color: C.textDim, fontSize: "0.85rem", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li>Calculatrice de rendement (simulation d&apos;investissement)</li>
            <li>Alertes de prix par email/notification</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
