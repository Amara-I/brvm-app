"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import PasswordField from "./PasswordField";
import GoogleSignInButton from "./GoogleSignInButton";
import styles from "./AuthForm.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mailWarning, setMailWarning] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMailWarning(null);
    setDevVerifyUrl(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email, password }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const details = json?.details?.fieldErrors as Record<string, string[] | undefined> | undefined;
      const fieldMessage = details?.password?.[0] ?? details?.email?.[0];
      setError(fieldMessage ?? json?.error ?? "Une erreur est survenue. Réessayez.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (result?.error) {
      router.push("/connexion?registered=1");
      return;
    }

    const mailError = typeof json?.data?.mailError === "string" ? json.data.mailError : null;
    if (mailError) {
      setMailWarning(mailError);
      if (typeof json?.data?.devVerifyUrl === "string") setDevVerifyUrl(json.data.devVerifyUrl);
      return;
    }

    router.push("/profil?verify=sent");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>
          Nom (facultatif)
        </label>
        <input
          id="name"
          className={styles.input}
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

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
        label={`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <PasswordField
        id="confirm"
        label="Confirmer le mot de passe"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />

      {error ? (
        <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </div>
      ) : null}

      {mailWarning ? (
        <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
          Compte créé, mais l&apos;email de confirmation n&apos;a pas pu être envoyé. {mailWarning}
          {devVerifyUrl ? (
            <>
              {" "}
              <Link href={devVerifyUrl}>Lien de développement</Link>
            </>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <Link href="/profil" className={styles.inlineLink}>
              Continuer vers mon profil
            </Link>
          </div>
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={loading || Boolean(mailWarning)}>
        {loading ? "Création du compte…" : "Créer mon compte"}
      </button>

      <GoogleSignInButton callbackUrl="/portefeuille" />

      <p className={styles.footer}>
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </form>
  );
}
