// ═══════════════════════════════════════════════════════════════════════════
// Header partagé — étape 11 (rebranding complet "ouestBourse")
// ═══════════════════════════════════════════════════════════════════════════
// Remplace la version étape 10 (thème sombre/or, texte "BRVM App") : utilisé
// désormais PARTOUT (landing page incluse, cf. AGENTS.md § Étape 11) avec le
// vrai nom + logo "ouestBourse" (marque de l'utilisateur, cf. règle
// non-négociable mise à jour) et le thème clair partagé (`lib/theme/colors.ts`).
//
// Server Component : lit la session NextAuth côté serveur et charge les
// données réelles pour le méga-menu "Sociétés cotées" (`groupCompaniesBySector`),
// délègue l'interactivité (surbrillance du lien actif, tiroir mobile,
// ouverture/fermeture du méga-menu) au Client Component `HeaderNav`.
// ═══════════════════════════════════════════════════════════════════════════

import Image from "next/image";
import Link from "next/link";
import { C, FONT_FAMILY } from "@/lib/theme/colors";
import { BRAND_NAME, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH, BRAND_LOGO_HEIGHT } from "@/lib/theme/brand";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { groupCompaniesBySector } from "@/lib/calc/market-summary-stats";
import HeaderNav from "@/components/nav/HeaderNav";

export default async function AppHeader() {
  const [user, dataset] = await Promise.all([getCurrentUser(), getCompaniesFullDataset()]);
  const sectorGroups = groupCompaniesBySector(dataset);

  return (
    <header
      style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT_FAMILY,
        position: "sticky",
        top: 0,
        zIndex: 90,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }} aria-label={`${BRAND_NAME} — accueil`}>
          <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} width={BRAND_LOGO_WIDTH} height={BRAND_LOGO_HEIGHT} style={{ height: 32, width: "auto" }} priority />
        </Link>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <HeaderNav
            sectorGroups={sectorGroups}
            totalCompanies={dataset.companies.length}
            user={user ? { name: user.name, email: user.email } : null}
          />
        </div>

        <div style={{ display: "none", alignItems: "center", gap: 12 }} className="app-header-desktop-actions">
          {user ? (
            <>
              <span style={{ color: C.textDim, fontSize: "0.8rem" }}>
                Bonjour, <strong style={{ color: C.text }}>{user.name ?? user.email}</strong>
              </span>
              <a
                href="/api/auth/signout"
                style={{
                  color: C.textDim,
                  fontSize: "0.8rem",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  textDecoration: "none",
                }}
              >
                Déconnexion
              </a>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                style={{
                  color: C.text,
                  fontSize: "0.8rem",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "6px 12px",
                  textDecoration: "none",
                }}
              >
                Connexion
              </Link>
              <Link
                href="/inscription"
                style={{
                  color: "#FFFFFF",
                  background: C.green,
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  borderRadius: 6,
                  padding: "6px 12px",
                  textDecoration: "none",
                }}
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>

      {/* `display:none` inline + media query ci-dessous : évite de dupliquer les
          actions desktop dans un Client Component uniquement pour un show/hide
          CSS pur (le tiroir mobile de HeaderNav couvre déjà ces actions <860px). */}
      <style>{`@media (min-width: 861px) { .app-header-desktop-actions { display: flex !important; } }`}</style>
    </header>
  );
}
