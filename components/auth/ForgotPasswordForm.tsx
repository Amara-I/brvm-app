"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isPlausibleEmail, messageFromAuthJson } from "./api-message";
import styles from "./AuthForm.module.css";

export default function ForgotPasswordForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPlausibleEmail(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(messageFromAuthJson(json, t, t("common.errorGeneric")));
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
          {t("auth.forgot.sent")}
        </p>
        {devResetUrl ? (
          <p className={styles.footer}>
            {t("auth.devMode")}{" "}
            <Link href={devResetUrl}>{t("auth.openResetLink")}</Link>
          </p>
        ) : null}
        <p className={styles.footer}>
          <Link href="/connexion">{t("auth.backToLogin")}</Link>
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          {t("auth.email")}
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
        {loading ? t("auth.sending") : t("auth.forgot.submit")}
      </button>

      <p className={styles.footer}>
        <Link href="/connexion">{t("auth.backToLogin")}</Link>
      </p>
    </form>
  );
}
