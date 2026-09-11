import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import LoginForm from "@/components/auth/LoginForm";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connexion — OuestBourse",
  description: "Connectez-vous à votre compte OuestBourse pour accéder à votre portefeuille.",
};

export default function ConnexionPage() {
  return (
    <AppHeader>
      <div className="ob-page" style={{ maxWidth: 440, margin: "0 auto", paddingTop: 24 }}>
        <PageHeader kicker="Compte" title="Connexion" lead="Accédez à votre portefeuille et vos préférences OuestBourse." />
        <div className="ob-card ob-card-pad">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </AppHeader>
  );
}
