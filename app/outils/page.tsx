// Page "Outils" — export, calculette de position, calendrier.
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  title: "Outils — OuestBourse",
  description: "Export Excel, calculette de position et calendrier des dividendes BRVM.",
};

function panel(): React.CSSProperties {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 };
}

export default function OutilsPage() {
  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader
          kicker="Plateforme"
          title="Outils"
          lead="Export de données, calculette de position et calendrier des dividendes."
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
                { label: "Taille de position", state: "Disponible" as const, href: "/outils/taille-position" },
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
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>Taille de position</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>
            Calculette de risque : quantité recommandée = (capital × taux %) / (entrée − stop). Cours chargé
            depuis la base lorsqu&apos;un ticker est choisi — jamais inventé. Gratuit, sans abonnement.
          </p>
          <a
            href="/outils/taille-position"
            style={{
              display: "inline-block",
              background: C.gold,
              color: "#080B12",
              fontWeight: 700,
              borderRadius: 8,
              padding: "8px 16px",
              textDecoration: "none",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            Ouvrir la calculette
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
