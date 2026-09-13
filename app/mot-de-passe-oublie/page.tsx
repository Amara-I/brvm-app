import AuthPage from "@/components/auth/AuthPage";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mot de passe oublié — OuestBourse",
  description: "Demandez un lien pour réinitialiser le mot de passe de votre compte OuestBourse.",
};

export default function MotDePasseOubliePage() {
  return (
    <AuthPage
      title="Mot de passe oublié"
      lead="Indiquez l’adresse email de votre compte. Si elle existe, vous recevrez un lien valable une heure."
    >
      <ForgotPasswordForm />
    </AuthPage>
  );
}
