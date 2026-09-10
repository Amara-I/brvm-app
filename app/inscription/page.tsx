// Page "Créer un compte" — étape 10 (navigation complète). Thème sombre/or.
import AppHeader from "@/components/AppHeader";
import RegisterForm from "@/components/auth/RegisterForm";
import { C } from "@/lib/theme/colors";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/theme/typography";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer un compte — OuestBourse",
  description: "Créez votre compte OuestBourse gratuitement pour suivre votre portefeuille sur la BRVM.",
};

export default function InscriptionPage() {
  return (
    <AppHeader>
      <div style={{ maxWidth: 460, margin: "0 auto", paddingTop: 24 }} data-align-left>
        <h1 style={PAGE_TITLE}>Créer un compte</h1>
        <p style={{ ...PAGE_LEAD, marginBottom: 28 }}>
          Gratuit — suivez votre portefeuille et vos sociétés favorites sur la BRVM.
        </p>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
          <RegisterForm />
        </div>
      </div>
    </AppHeader>
  );
}
