// Page "Outils" — étape 10 + agent DESIGN premium (étape 16).
import Link from "next/link";
import { ResearchCategory } from "@prisma/client";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Outils — OuestBourse",
  description: "Export de données, alertes et suggestions d'amélioration issues de la veille automatisée OuestBourse.",
};

const CATEGORY_LABELS: Record<string, string> = {
  DESIGN: "✦ Design premium",
  UX: "Expérience utilisateur",
  CONTENU: "Contenu & actualités",
  FONCTIONNALITE: "Fonctionnalité",
  CONCURRENCE: "Veille concurrentielle",
};

function panel(): React.CSSProperties {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 };
}

export default async function OutilsPage({
  searchParams,
}: {
  searchParams?: { cat?: string };
}) {
  const catRaw = searchParams?.cat?.toUpperCase();
  const catFilter =
    catRaw && catRaw !== "TOUS" && (Object.values(ResearchCategory) as string[]).includes(catRaw)
      ? (catRaw as ResearchCategory)
      : undefined;
  let findings: Awaited<ReturnType<typeof prisma.researchFinding.findMany>> = [];
  let designCount = 0;
  try {
    findings = await prisma.researchFinding.findMany({
      where: catFilter ? { category: catFilter } : undefined,
      orderBy: { discoveredAt: "desc" },
      take: 40,
    });
    designCount = await prisma.researchFinding.count({ where: { category: ResearchCategory.DESIGN } });
  } catch {
    findings = [];
    designCount = 0;
  }

  const filters = ["TOUS", "DESIGN", "UX", "FONCTIONNALITE", "CONCURRENCE", "CONTENU"] as const;

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Plateforme"
          title="Outils"
          lead="Export de données et veille automatisée pour perfectionner la plateforme (design premium inclus)."
        />

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>Capacités OuestBourse</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Synthèse honnête de ce qui est disponible aujourd&apos;hui — rien d&apos;inventé.
          </p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 6,
            }}
          >
            {(
              [
                { label: "Cours BRVM", state: "Disponible" as const, href: "/marche" },
                { label: "Graphes", state: "Disponible" as const, href: "/graphes" },
                { label: "Signal expliqué", state: "Disponible" as const, href: "/societes-cotees" },
                { label: "Calendrier dividendes", state: "Disponible" as const, href: "/calendrier-dividendes" },
                { label: "Export Excel", state: "Disponible" as const, href: "/api/export/excel" },
                { label: "Alertes de seuil", state: "Disponible" as const, href: "/graphes" },
                { label: "Centre de notifications", state: "Disponible" as const, href: "/notifications" },
                { label: "Préférences d'alertes", state: "Disponible" as const, href: "/profil" },
                { label: "Simulation rendements", state: "Disponible" as const, href: "/simulation" },
              ] as const
            ).map((cap) => (
              <li
                key={cap.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                {cap.href && cap.state === "Disponible" ? (
                  <a href={cap.href} style={{ color: C.text, textDecoration: "none", fontWeight: 600 }}>
                    {cap.label}
                  </a>
                ) : (
                  <span style={{ color: C.text, fontWeight: 600 }}>{cap.label}</span>
                )}
                <span
                  style={{
                    color: cap.state === "Disponible" ? C.green : C.textDim,
                    fontWeight: 700,
                    fontSize: "var(--fs-body-xs)",
                  }}
                >
                  {cap.state}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>Aperçu propositions design</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Avant / après des brouillons App Designer — rien n’est appliqué tant que vous n’approuvez pas.
          </p>
          <a
            href="/apercu-design"
            style={{
              display: "inline-block",
              background: C.blue,
              color: "#fff",
              fontWeight: 700,
              borderRadius: 8,
              padding: "8px 16px",
              textDecoration: "none",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            Voir les aperçus
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>Calendrier des dividendes</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Dates de détachement, mise en paiement et montants par exercice pour les sociétés cotées.
          </p>
          <a
            href="/calendrier-dividendes"
            style={{
              display: "inline-block",
              background: C.blue,
              color: "#fff",
              fontWeight: 700,
              borderRadius: 8,
              padding: "8px 16px",
              textDecoration: "none",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            Ouvrir le calendrier
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>Export Excel</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Exportez les données BRVM, projections et classements au format Excel (3 feuilles).
          </p>
          <a
            href="/api/export/excel"
            style={{
              display: "inline-block",
              background: C.green,
              color: "#080B12",
              fontWeight: 700,
              borderRadius: 8,
              padding: "8px 16px",
              textDecoration: "none",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            Télécharger le fichier Excel
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 4 }}>Agent design premium</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Veille quotidienne (cron 06:00 UTC ou <code style={{ color: C.silver }}>npm run research:run</code>).
            Les propositions DESIGN/UX à trancher sont sur{" "}
            <Link href="/apercu-design" style={{ color: C.gold }}>
              /apercu-design
            </Link>
            . Rien n&apos;est appliqué automatiquement.
            {designCount > 0 ? ` ${designCount} suggestion(s) DESIGN en base.` : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {filters.map((f) => {
              const active = (catRaw ?? "TOUS") === f;
              return (
                <a
                  key={f}
                  href={f === "TOUS" ? "/outils" : `/outils?cat=${f}`}
                  style={{
                    textDecoration: "none",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: "var(--fs-body-xs)",
                    fontWeight: active ? 700 : 400,
                    background: active ? C.gold : C.bg,
                    color: active ? "#080B12" : C.text,
                    border: `1px solid ${active ? C.gold : C.border}`,
                  }}
                >
                  {f === "TOUS" ? "Toutes" : CATEGORY_LABELS[f] ?? f}
                </a>
              );
            })}
          </div>

          {findings.length === 0 ? (
            <EmptyState
              title="Aucune suggestion pour l’instant"
              body="Activez RESEARCH_AGENT_ENABLED, puis lancez npm run research:run. Avec une clé SerpAPI ou le fallback Google News RSS."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {findings.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: 12,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ color: C.textDim, fontSize: "var(--fs-body-xs)", marginBottom: 4 }}>
                    {CATEGORY_LABELS[f.category] ?? f.category} · {f.status} ·{" "}
                    {new Date(f.discoveredAt).toLocaleDateString("fr-FR")}
                  </div>
                  <div style={{ color: C.text, fontSize: "var(--fs-body-sm)", fontWeight: 700 }}>{f.title}</div>
                  {f.summary && (
                    <div style={{ color: C.textDim, fontSize: "var(--fs-body-xs)", marginTop: 2 }}>{f.summary}</div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 8 }}>Bientôt disponible</h2>
          <p style={{ ...PANEL_TEXT, margin: 0 }}>
            Alertes de seuil, digest quotidien et bibliothèque de documents par société — annoncés honnêtement comme
            « bientôt », pas encore branchés.
          </p>
        </div>
      </div>
    </AppHeader>
  );
}
