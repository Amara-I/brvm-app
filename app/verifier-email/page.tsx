import Link from "next/link";
import { redirect } from "next/navigation";
import AuthPage from "@/components/auth/AuthPage";
import { verifyEmailWithToken } from "@/lib/auth/verify-email";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Confirmation d’email — OuestBourse",
  description: "Confirmez l’adresse email de votre compte OuestBourse.",
};

type Props = {
  searchParams: { token?: string };
};

export default async function VerifierEmailPage({ searchParams }: Props) {
  const result = await verifyEmailWithToken(searchParams.token);

  if (result.ok) {
    redirect("/connexion?verified=1");
  }

  return (
    <AuthPage
      title="Lien de confirmation"
      lead="Ce lien est invalide ou a déjà été utilisé."
    >
      <p style={{ margin: "0 0 12px", color: "var(--c-text)" }}>
        Demandez un nouvel email depuis votre compte, ou reconnectez-vous puis cliquez sur « Renvoyer
        l’email ».
      </p>
      <p style={{ margin: 0 }}>
        <Link href="/connexion" style={{ color: "var(--c-gold)" }}>
          Aller à la connexion
        </Link>
      </p>
    </AuthPage>
  );
}
