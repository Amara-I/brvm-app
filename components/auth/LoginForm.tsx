"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { authErrorMessage } from "@/lib/auth/oauth-errors";
import PasswordField from "./PasswordField";
import OAuthSignInButtons from "./OAuthSignInButtons";
import styles from "./AuthForm.module.css";

function messageFromQuery(searchParams: URLSearchParams): { text: string; ok: boolean } | null {
  if (searchParams.get("verified") === "1") {
    return { ok: true, text: "Adresse email confirmée. Vous pouvez vous connecter." };
  }
  if (searchParams.get("reset") === "1") {
    return { ok: true, text: "Mot de passe mis à jour. Connectez-vous avec le nouveau mot de passe." };
  }
  if (searchParams.get("registered") === "1") {
    return { ok: true, text: "Compte créé. Connectez-vous pour continuer." };
  }
  const error = searchParams.get("error");
  if (error) {
    return { ok: false, text: authErrorMessage(error) };
  }
  return null;
}

export default function LoginForm({ oauthProviders = [] }: { oauthProviders?: readonly string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portefeuille";
  const queryMessage = useMemo(() => messageFromQuery(searchParams), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (result?.error) {
      setError(authErrorMessage("CredentialsSignin"));
      return;
    }
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/portefeuille");
    router.refresh();
  }

  const alert = error ? { ok: false, text: error } : queryMessage;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Adresse email
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <PasswordField
        id="password"
        label="Mot de passe"
        value={password}
        onChange={setPassword}
        extra={
          <Link href="/mot-de-passe-oublie" className={styles.inlineLink}>
            Mot de passe oublié ?
          </Link>
        }
      />

      {alert ? (
        <div role="alert" className={`${styles.alert} ${alert.ok ? styles.alertOk : styles.alertError}`}>
          {alert.text}
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      <OAuthSignInButtons
        providers={oauthProviders}
        callbackUrl={callbackUrl.startsWith("/") ? callbackUrl : "/portefeuille"}
      />

      <p className={styles.footer}>
        Pas encore de compte ?{" "}
        <Link href="/inscription">Créer un compte</Link>
      </p>
    </form>
  );
}
