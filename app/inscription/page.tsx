import AppHeader from "@/components/AppHeader";
import RegisterForm from "@/components/auth/RegisterForm";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer un compte — OuestBourse",
  description: "Créez votre compte OuestBourse gratuitement pour suivre votre portefeuille sur la BRVM.",
};

export default function InscriptionPage() {
  return (
    <AppHeader>
      <div className="ob-page" style={{ maxWidth: 440, margin: "0 auto", paddingTop: 24 }}>
        <PageHeader
          kicker="Compte"
          title="Créer un compte"
          lead="Gratuit — suivez votre portefeuille et vos sociétés favorites sur la BRVM."
        />
        <div className="ob-card ob-card-pad">
          <RegisterForm />
        </div>
      </div>
    </AppHeader>
  );
}
