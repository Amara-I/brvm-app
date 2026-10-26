"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { isPlausibleEmail, messageFromAuthJson } from "./api-message";
import PasswordField from "./PasswordField";
import OAuthSignInButtons from "./OAuthSignInButtons";
import styles from "./AuthForm.module.css";

export default function RegisterForm({ oauthProviders = [] }: { oauthProviders?: readonly string[] }) {
  const { t } = useI18n();
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

    if (!isPlausibleEmail(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordMin", { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
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
      setError(messageFromAuthJson(json, t, t("common.errorGeneric")));
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
          {t("auth.register.name")}
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

      <PasswordField
        id="password"
        label={t("auth.register.password", { count: MIN_PASSWORD_LENGTH })}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <PasswordField
        id="confirm"
        label={t("auth.register.confirm")}
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
          {t("auth.register.mailFailed")} {mailWarning}
          {devVerifyUrl ? (
            <>
              {" "}
              <Link href={devVerifyUrl}>{t("auth.devLink")}</Link>
            </>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <Link href="/profil" className={styles.inlineLink}>
              {t("auth.register.continueProfile")}
            </Link>
          </div>
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={loading || Boolean(mailWarning)}>
        {loading ? t("auth.register.submitting") : t("auth.register.submit")}
      </button>

      <OAuthSignInButtons providers={oauthProviders} callbackUrl="/portefeuille" />

      <p className={styles.footer}>
        {t("auth.register.already")} <Link href="/connexion">{t("auth.register.signIn")}</Link>
      </p>
    </form>
  );
}
