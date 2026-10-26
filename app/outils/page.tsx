// Page "Outils" — export, calculette de position, calendrier.
import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import { C } from "@/lib/theme/colors";
import { SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";
import PageHeader from "@/components/ui/PageHeader";
import { getI18n } from "@/lib/i18n/get-i18n";

export function generateMetadata(): Metadata {
  const { t } = getI18n();
  return {
    title: t("tools.meta.title"),
    description: t("tools.meta.description"),
  };
}

function panel(): React.CSSProperties {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 };
}

export default function OutilsPage() {
  const { t } = getI18n();
  const available = t("tools.page.available");
  const capabilities = [
    { label: t("tools.page.quotes"), state: available, href: "/marche" },
    { label: t("tools.page.charts"), state: available, href: "/graphes" },
    { label: t("tools.page.signal"), state: available, href: "/societes-cotees" },
    { label: t("tools.page.dividendCalendar"), state: available, href: "/calendrier-dividendes" },
    { label: t("common.exportExcel"), state: available, href: "/api/export/excel" },
    { label: t("tools.page.alerts"), state: available, href: "/graphes" },
    { label: t("tools.page.notifications"), state: available, href: "/notifications" },
    { label: t("tools.page.alertPrefs"), state: available, href: "/profil" },
    { label: t("tools.page.simulation"), state: available, href: "/simulation" },
    { label: t("tools.page.positionSize"), state: available, href: "/outils/taille-position" },
  ] as const;

  return (
    <AppHeader>
      <div className="ob-page">
        <PageHeader kicker={t("tools.page.kicker")} title={t("tools.page.title")} lead={t("tools.page.lead")} />

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>{t("tools.page.capabilitiesTitle")}</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>{t("tools.page.capabilitiesLead")}</p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 6,
            }}
          >
            {capabilities.map((cap) => (
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
                  minWidth: 0,
                }}
              >
                {cap.href && cap.state === available ? (
                  <a
                    href={cap.href}
                    style={{ color: C.text, textDecoration: "none", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {cap.label}
                  </a>
                ) : (
                  <span style={{ color: C.text, fontWeight: 600 }}>{cap.label}</span>
                )}
                <span
                  style={{
                    color: cap.state === available ? C.green : C.textDim,
                    fontWeight: 700,
                  flexShrink: 0,
                  whiteSpace: "nowrap" as const,
                }}
                >
                  {cap.state}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>{t("tools.page.positionTitle")}</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>{t("tools.page.positionLead")}</p>
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
            {t("tools.page.openCalc")}
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>{t("tools.page.calendarTitle")}</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>{t("tools.page.calendarLead")}</p>
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
            {t("tools.page.openCalendar")}
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left" }}>{t("tools.page.excelTitle")}</h2>
          <p style={{ ...PANEL_TEXT, marginBottom: 12 }}>{t("tools.page.excelLead")}</p>
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
            {t("tools.page.downloadExcel")}
          </a>
        </div>

        <div style={panel()} data-align-left>
          <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 8 }}>{t("common.comingSoon")}</h2>
          <p style={{ ...PANEL_TEXT, margin: 0 }}>{t("tools.page.soonLead")}</p>
        </div>
      </div>
    </AppHeader>
  );
}
