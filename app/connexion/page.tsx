// Page "Connexion" — étape 10 (navigation complète). Thème sombre/or
// (contrainte non-négociable — pas d'exception ici, seule la landing page en
// bénéficie). Référencée par `authOptions.pages.signIn` (étape 7).
import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import LoginForm from "@/components/auth/LoginForm";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connexion — OuestBourse",
  description: "Connectez-vous à votre compte OuestBourse pour accéder à votre portefeuille.",
};

export default function ConnexionPage() {
  return (
    <AppHeader>
      <div style={{ maxWidth: 460, margin: "0 auto", paddingTop: 24 }} data-align-left>
        <h1 style={PAGE_TITLE}>Connexion</h1>
        <p style={{ ...PAGE_LEAD, marginBottom: 28 }}>
          Accédez à votre portefeuille et vos préférences OuestBourse.
        </p>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </AppHeader>
  );
}
