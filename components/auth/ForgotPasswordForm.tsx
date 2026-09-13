"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./AuthForm.module.css";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(json?.error ?? "Une erreur est survenue. Réessayez.");
      return;
    }

    setSent(true);
    if (typeof json?.data?.devResetUrl === "string") {
      setDevResetUrl(json.data.devResetUrl);
    }
  }

  if (sent) {
    return (
      <div>
        <p className={`${styles.alert} ${styles.alertOk}`} role="status">
          Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé.
          Pensez à vérifier vos courriers indésirables.
        </p>
        {devResetUrl ? (
          <p className={styles.footer}>
            Mode développement —{" "}
            <Link href={devResetUrl}>ouvrir le lien de réinitialisation</Link>
          </p>
        ) : null}
        <p className={styles.footer}>
          <Link href="/connexion">Retour à la connexion</Link>
        </p>
      </div>
    );
  }

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

      {error ? (
        <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? "Envoi…" : "Envoyer le lien"}
      </button>

      <p className={styles.footer}>
        <Link href="/connexion">Retour à la connexion</Link>
      </p>
    </form>
  );
}
