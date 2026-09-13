import AuthPage from "@/components/auth/AuthPage";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { peekAuthToken } from "@/lib/auth/tokens";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouveau mot de passe — OuestBourse",
  description: "Choisissez un nouveau mot de passe pour votre compte OuestBourse.",
};

type Props = {
  searchParams: { token?: string };
};

export default async function ReinitialiserMotDePassePage({ searchParams }: Props) {
  const token = searchParams.token?.trim() ?? "";
  const valid = token.length >= 16 ? await peekAuthToken(token, "PASSWORD_RESET") : null;

  return (
    <AuthPage
      title="Nouveau mot de passe"
      lead="Choisissez un mot de passe d’au moins 8 caractères. L’ancien ne fonctionnera plus."
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p>
          Ce lien de réinitialisation est invalide ou a expiré.{" "}
          <Link href="/mot-de-passe-oublie" style={{ color: "var(--c-gold)" }}>
            Demander un nouveau lien
          </Link>
          .
        </p>
      )}
    </AuthPage>
  );
}
