import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import SignOutClient from "./SignOutClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Déconnexion — OuestBourse",
  description: "Déconnexion de votre compte OuestBourse.",
};

export default function DeconnexionPage() {
  return (
    <AuthPage title="Déconnexion" lead="Fermeture de la session en cours…">
      <Suspense fallback={<p>Déconnexion…</p>}>
        <SignOutClient />
      </Suspense>
    </AuthPage>
  );
}
