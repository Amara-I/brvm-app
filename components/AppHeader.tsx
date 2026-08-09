// ═══════════════════════════════════════════════════════════════════════════
// Header de navigation interne — étape 10 (navigation complète)
// ═══════════════════════════════════════════════════════════════════════════
// Server Component, additif : enveloppe les pages internes (`/marche`,
// `/screener`, `/portefeuille`, `/graphes`, `/societes-cotees`, `/actualites`,
// `/outils`, `/mentions-legales`) SANS modifier leur contenu propre. Ne
// touche à aucun texte/tab/sidebar du dashboard `BrvmDashboardClient`
// (contrainte non-négociable) : c'est une barre ajoutée AU-DESSUS.
//
// Session lue côté serveur (`getCurrentUser()` → NextAuth `getServerSession`)
// pour éviter d'avoir à brancher un `<SessionProvider>` client global juste
// pour afficher "Connexion" vs. "Bonjour {nom}".
//
// N'est PAS utilisé sur la landing page (`/`), qui a son propre header dans
// sa propre palette (exception scoped, cf. règle non-négociable mise à jour).
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { C, FONT_FAMILY } from "@/lib/theme/colors";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import NavLinks from "@/components/NavLinks";

export default async function AppHeader() {
  const user = await getCurrentUser();

  return (
    <header
      style={{
        background: C.panel,
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT_FAMILY,
        position: "sticky",
        top: 0,
        zIndex: 50,
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
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: "1.2rem" }}>📊</span>
          <span style={{ color: C.gold, fontWeight: "bold", fontSize: "1.05rem" }}>BRVM App</span>
        </Link>

        <NavLinks />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  color: "#080B12",
                  background: C.gold,
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
    </header>
  );
}
