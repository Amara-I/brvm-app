// Page "Créer un compte" — étape 10 (navigation complète). Thème sombre/or.
import AppHeader from "@/components/AppHeader";
import RegisterForm from "@/components/auth/RegisterForm";
import { C } from "@/lib/theme/colors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer un compte — BRVM App",
  description: "Créez votre compte BRVM App gratuitement pour suivre votre portefeuille sur la BRVM.",
};

export default function InscriptionPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Trebuchet MS', Georgia, serif" }}>
      <AppHeader />
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "56px 20px" }}>
        <h1 style={{ color: C.text, fontSize: "1.4rem", marginBottom: 4, textAlign: "center" }}>Créer un compte</h1>
        <p style={{ color: C.textDim, fontSize: "0.85rem", textAlign: "center", marginBottom: 28 }}>
          Gratuit — suivez votre portefeuille et vos sociétés favorites sur la BRVM.
        </p>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
