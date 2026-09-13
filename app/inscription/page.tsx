import AuthPage from "@/components/auth/AuthPage";
import RegisterForm from "@/components/auth/RegisterForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer un compte — OuestBourse",
  description: "Créez votre compte OuestBourse gratuitement pour suivre votre portefeuille sur la BRVM.",
};

export default function InscriptionPage() {
  return (
    <AuthPage
      title="Créer un compte"
      lead="Gratuit — suivez votre portefeuille et vos sociétés favorites sur la BRVM. Un email de confirmation vous sera envoyé."
    >
      <RegisterForm />
    </AuthPage>
  );
}
