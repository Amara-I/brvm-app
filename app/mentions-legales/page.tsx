// ═══════════════════════════════════════════════════════════════════════════
// Page "Mentions légales" — étape 9 (checklist de conformité)
// ═══════════════════════════════════════════════════════════════════════════
// Page NOUVELLE et AUTONOME : elle ne modifie ni ne remplace aucun texte,
// couleur ou élément du dashboard existant (contrainte non-négociable du
// projet — cf. AGENTS.md). Elle réutilise la même palette pour la cohérence
// visuelle mais vit à une URL dédiée (/mentions-legales), non liée depuis le
// footer du dashboard pour l'instant : ajouter un lien dans ce footer
// reviendrait à modifier un texte déjà codé en dur, ce qui nécessite une
// validation explicite de l'utilisateur (cf. COMPLIANCE_CHECKLIST.md).
//
// Contenu couvrant les points du brief étape 9 :
//   - Renforcement du disclaimer financier déjà présent en footer.
//   - Mention légale détaillée sur l'origine des données (BRVM, Sikafinance,
//     Richbourse) et leur statut de fiabilité (source de vérité vs.
//     complémentaire).
//   - Informations RGPD (données collectées, finalités, droits, contact).
// ═══════════════════════════════════════════════════════════════════════════

import AppHeader from "@/components/AppHeader";
import { getI18n } from "@/lib/i18n/get-i18n";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE, SECTION_TITLE, PANEL_TEXT } from "@/lib/theme/typography";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16, textAlign: "left" }}
      data-align-left
    >
      <h2 style={{ ...SECTION_TITLE, textAlign: "left", marginBottom: 12 }}>{title}</h2>
      <div style={{ ...PANEL_TEXT, color: C.text, fontSize: "var(--fs-body-sm)" }}>{children}</div>
    </section>
  );
}

export function generateMetadata() {
  const { t } = getI18n();
  return {
    title: t("legal.metaTitle"),
    description: t("legal.metaDescription"),
  };
}

export default function MentionsLegalesPage() {
  const { t } = getI18n();
  return (
    <AppHeader>
      <div style={{ width: "100%", color: C.text, paddingTop: 0 }}>
        <h1 style={PAGE_TITLE}>{t("legal.title")}</h1>
        <p style={{ ...PAGE_LEAD, marginBottom: 24 }}>{t("legal.updated")}</p>

        <Section title={t("legal.origin.title")}>
          <p>{t("legal.origin.intro")}</p>
          <ol>
            <li>
              <strong style={{ color: C.gold }}>{t("legal.origin.brvmName")}</strong>
              {t("legal.origin.brvm")}
            </li>
            <li>
              <strong style={{ color: C.teal }}>{t("legal.origin.sikaName")}</strong>
              {t("legal.origin.sika")}
            </li>
            <li>
              <strong>{t("legal.origin.richName")}</strong>
              {t("legal.origin.rich")}
            </li>
            <li>{t("legal.origin.manual")}</li>
          </ol>
          <p>{t("legal.origin.audit")}</p>
          <p style={{ color: C.textDim, fontSize: "var(--fs-body-xs)" }}>{t("legal.origin.affiliation")}</p>
        </Section>

        <Section title={t("legal.disclaimer.title")}>
          <p>
            {t("legal.disclaimer.p1Before")}
            <strong>{t("legal.disclaimer.p1Emphasis")}</strong>
            {t("legal.disclaimer.p1After")}
          </p>
          <p>{t("legal.disclaimer.p2")}</p>
          <p>{t("legal.disclaimer.p3")}</p>
        </Section>

        <Section title={t("legal.privacy.title")}>
          <p>
            <strong>{t("legal.privacy.collectedLabel")}</strong>
            {t("legal.privacy.collected")}
          </p>
          <p>
            <strong>{t("legal.privacy.purposeLabel")}</strong>
            {t("legal.privacy.purpose")}
          </p>
          <p>
            <strong>{t("legal.privacy.cookiesLabel")}</strong>
            {t("legal.privacy.cookies")}
          </p>
          <p>
            <strong>{t("legal.privacy.analyticsLabel")}</strong>
            {t("legal.privacy.analytics")}
          </p>
          <p>
            <strong>{t("legal.privacy.rightsLabel")}</strong>
            {t("legal.privacy.rights")}
          </p>
        </Section>

        <Section title={t("legal.publisher.title")}>
          <p style={{ color: C.textDim }}>{t("legal.publisher.body")}</p>
        </Section>
      </div>
    </AppHeader>
  );
}
