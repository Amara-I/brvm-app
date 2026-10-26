"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { isPlausibleEmail, oauthMessage } from "./api-message";
import PasswordField from "./PasswordField";
import OAuthSignInButtons from "./OAuthSignInButtons";
import styles from "./AuthForm.module.css";

function messageFromQuery(searchParams: URLSearchParams, t: TFunc): { text: string; ok: boolean } | null {
  if (searchParams.get("verified") === "1") {
    return { ok: true, text: t("auth.login.verified") };
  }
  if (searchParams.get("reset") === "1") {
    return { ok: true, text: t("auth.login.passwordUpdated") };
  }
  if (searchParams.get("registered") === "1") {
    return { ok: true, text: t("auth.login.registered") };
  }
  const error = searchParams.get("error");
  if (error) {
    return { ok: false, text: oauthMessage(error, t) };
  }
  return null;
}

export default function LoginForm({ oauthProviders = [] }: { oauthProviders?: readonly string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portefeuille";
  const queryMessage = useMemo(() => messageFromQuery(searchParams, t), [searchParams, t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPlausibleEmail(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    if (!password) {
      setError(t("auth.passwordRequired"));
      return;
    }
    setLoading(true);
    const result = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (result?.error) {
      setError(oauthMessage("CredentialsSignin", t));
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
        label={t("auth.password")}
        value={password}
        onChange={setPassword}
        extra={
          <Link href="/mot-de-passe-oublie" className={styles.inlineLink}>
            {t("auth.login.forgot")}
          </Link>
        }
      />

      {alert ? (
        <div role="alert" className={`${styles.alert} ${alert.ok ? styles.alertOk : styles.alertError}`}>
          {alert.text}
        </div>
      ) : null}

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? t("auth.login.submitting") : t("auth.login.submit")}
      </button>

      <OAuthSignInButtons
        providers={oauthProviders}
        callbackUrl={callbackUrl.startsWith("/") ? callbackUrl : "/portefeuille"}
      />

      <p className={styles.footer}>
        {t("auth.login.noAccount")}{" "}
        <Link href="/inscription">{t("auth.login.createAccount")}</Link>
      </p>
    </form>
  );
}
