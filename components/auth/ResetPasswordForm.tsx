"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { messageFromAuthJson } from "./api-message";
import PasswordField from "./PasswordField";
import styles from "./AuthForm.module.css";

type Props = {
  token: string;
};

export default function ResetPasswordForm({ token }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordMin", { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
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
      setError(messageFromAuthJson(json, t, t("auth.reset.expired")));
      return;
    }

    router.push("/connexion?reset=1");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PasswordField
        id="password"
        label={t("auth.reset.password", { count: MIN_PASSWORD_LENGTH })}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <PasswordField
        id="confirm"
        label={t("auth.reset.confirm")}
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
        {loading ? t("auth.saving") : t("auth.reset.submit")}
      </button>

      <p className={styles.footer}>
        <Link href="/mot-de-passe-oublie">{t("auth.reset.requestNew")}</Link>
      </p>
    </form>
  );
}
