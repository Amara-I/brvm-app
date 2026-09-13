import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connexion — OuestBourse",
  description: "Connectez-vous à votre compte OuestBourse pour accéder à votre portefeuille.",
};

export default function ConnexionPage() {
  return (
    <AuthPage
      title="Connexion"
      lead="Accédez à votre portefeuille et vos préférences OuestBourse."
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthPage>
  );
}
