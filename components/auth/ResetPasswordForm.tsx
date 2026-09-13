"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import PasswordField from "./PasswordField";
import styles from "./AuthForm.module.css";

type Props = {
  token: string;
};

export default function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(json?.error ?? "Ce lien est invalide ou a expiré.");
      return;
    }

    router.push("/connexion?reset=1");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PasswordField
        id="password"
        label={`Nouveau mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <PasswordField
        id="confirm"
        label="Confirmer le nouveau mot de passe"
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

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>

      <p className={styles.footer}>
        <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </p>
    </form>
  );
}
