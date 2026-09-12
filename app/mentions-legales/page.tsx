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

export const metadata = {
  title: "Mentions légales — OuestBourse",
  description: "Mentions légales, origine des données, protection des données personnelles et disclaimer financier de OuestBourse.",
};

export default function MentionsLegalesPage() {
  return (
    <AppHeader>
      <div style={{ width: "100%", color: C.text, paddingTop: 0 }}>
        <h1 style={PAGE_TITLE}>Mentions légales</h1>
        <p style={{ ...PAGE_LEAD, marginBottom: 24 }}>
          Dernière mise à jour : conformément au déploiement de l&apos;étape 9 de la feuille de route (cf. AGENTS.md).
        </p>

        <Section title="Origine et fiabilité des données">
          <p>
            Les données financières présentées (cours de clôture, dividendes, ratios) sont issues, par ordre de priorité de fiabilité
            en cas de divergence entre sources :
          </p>
          <ol>
            <li>
              <strong style={{ color: C.gold }}>BRVM.org</strong> — source officielle de la Bourse Régionale des Valeurs Mobilières.
              Utilisée comme source de vérité principale pour les cours, volumes et capitalisations.
            </li>
            <li>
              <strong style={{ color: C.teal }}>Sikafinance.com</strong> — portail d&apos;actualités et de marché, utilisé en
              complément pour les indices et l&apos;actualité.
            </li>
            <li>
              <strong>Richbourse.com</strong> — plateforme d&apos;informations boursières, utilisée en croisement/vérification des
              ratios financiers.
            </li>
            <li>Saisie manuelle — utilisée uniquement en secours si les trois sources automatisées échouent simultanément.</li>
          </ol>
          <p>
            Tout écart supérieur à 2% entre deux sources pour une même donnée est enregistré et audité manuellement. La source et
            l&apos;horodatage de synchronisation de la donnée retenue sont affichés de façon transparente dans la fiche de chaque
            société cotée.
          </p>
          <p style={{ color: C.textDim, fontSize: "var(--fs-body-xs)" }}>
            OuestBourse n&apos;est affilié à aucune des sources citées ; leurs noms sont mentionnés à titre d&apos;attribution des
            données, conformément à un usage raisonnable et non commercial de contenus publiquement accessibles.
          </p>
        </Section>

        <Section title="Avertissement financier">
          <p>
            ⚠️ Les informations, indicateurs, scores, signaux (« ACHAT », « CONSERVER », « VENDRE », etc.) et projections de cours
            présentés sur OuestBourse sont fournis à titre <strong>purement informatif et pédagogique</strong>. Ils reposent sur des
            modèles statistiques simples (régression linéaire sur données historiques) et ne prennent en compte ni l&apos;actualité
            de l&apos;émetteur, ni les conditions de marché futures, ni la situation personnelle de l&apos;investisseur.
          </p>
          <p>
            Ces éléments ne constituent en aucun cas un conseil en investissement, une recommandation d&apos;achat ou de vente, ni
            une sollicitation au sens de la réglementation applicable dans l&apos;espace UEMOA. Les performances passées ne
            préjugent pas des performances futures. Investir sur un marché financier comporte un risque de perte en capital.
          </p>
          <p>
            Avant toute décision d&apos;investissement, il est recommandé de consulter un conseiller financier agréé et de se
            référer aux communiqués officiels des sociétés cotées ainsi qu&apos;aux avis de la BRVM.
          </p>
        </Section>

        <Section title="Protection des données personnelles (RGPD)">
          <p>
            <strong>Données collectées</strong> — lors de la création d&apos;un compte : adresse email, mot de passe (haché, jamais
            stocké en clair), nom (facultatif). Dans le cadre de la fonctionnalité « Portefeuille » : les positions saisies par
            l&apos;utilisateur (société, quantité, prix d&apos;achat).
          </p>
          <p>
            <strong>Finalité</strong> — ces données sont utilisées exclusivement pour permettre l&apos;authentification et le suivi
            d&apos;un portefeuille personnel. Elles ne sont ni revendues, ni partagées avec des tiers à des fins commerciales.
          </p>
          <p>
            <strong>Cookies</strong> — seul un cookie de session strictement nécessaire au fonctionnement de
            l&apos;authentification est déposé (NextAuth.js). Aucun cookie de mesure d&apos;audience ou publicitaire n&apos;est
            utilisé à ce jour ; si cela devait changer, un bandeau de consentement serait mis en place au préalable.
          </p>
          <p>
            <strong>Mesure d&apos;usage (première partie)</strong> — afin d&apos;améliorer le produit, OuestBourse
            enregistre des événements d&apos;usage agrégés (page visitée, fonctionnalité cliquée) dans sa propre base.
            Aucune adresse e-mail, nom, adresse IP ou contenu de formulaire n&apos;est stocké dans ces événements. Un
            identifiant de session anonyme (stocké en localStorage) permet d&apos;estimer le nombre de visiteurs
            distincts. Les événements sont conservés 90 jours. Si vous êtes connecté, seul l&apos;identifiant interne
            du compte peut être associé à l&apos;événement, jamais votre e-mail.
          </p>
          <p>
            <strong>Vos droits</strong> — conformément à la réglementation applicable en matière de protection des données, vous
            disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement et de portabilité de vos données. Pour exercer
            ces droits ou pour toute question, contactez l&apos;éditeur de l&apos;application à l&apos;adresse indiquée dans les
            informations éditeur ci-dessous.
          </p>
        </Section>

        <Section title="Éditeur">
          <p style={{ color: C.textDim }}>
            Application développée à titre de projet d&apos;analyse financière indépendant. Coordonnées de contact à compléter par
            l&apos;éditeur avant mise en production (nom, adresse, email de contact, hébergeur).
          </p>
        </Section>
      </div>
    </AppHeader>
  );
}
