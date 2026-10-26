"use client";

import { useState, type ReactElement } from "react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { OAUTH_SIGN_IN_BUTTONS, type OAuthButtonId } from "@/lib/auth/oauth-errors";
import styles from "./AuthForm.module.css";

type Props = {
  callbackUrl: string;
  /** Fournisseurs réellement enregistrés par NextAuth (jamais de secret). */
  providers: readonly string[];
};

function isOAuthButtonId(id: string): id is OAuthButtonId {
  return OAUTH_SIGN_IN_BUTTONS.some((button) => button.id === id);
}

const BUTTON_CLASS: Record<OAuthButtonId, string> = {
  google: styles.google,
  facebook: styles.facebook,
  apple: styles.apple,
  "azure-ad": styles.microsoft,
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073C0 18.062 4.388 23.027 10.125 23.927v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.1 9.5c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.8-.7c-1.5 0-2.8.8-3.6 2.1-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7 1.9-1.1 2.6-2.2c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.5Zm-2-6.4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const ICONS: Record<OAuthButtonId, () => ReactElement> = {
  google: GoogleIcon,
  facebook: FacebookIcon,
  apple: AppleIcon,
  "azure-ad": MicrosoftIcon,
};

function providerLabel(id: OAuthButtonId, t: TFunc): string {
  switch (id) {
    case "google":
      return t("auth.oauth.google");
    case "facebook":
      return t("auth.oauth.facebook");
    case "apple":
      return t("auth.oauth.apple");
    case "azure-ad":
      return t("auth.oauth.microsoft");
  }
}

export default function OAuthSignInButtons({ callbackUrl, providers }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState<OAuthButtonId | null>(null);
  const available = OAUTH_SIGN_IN_BUTTONS.map((button) => button.id).filter(
    (id) => providers.includes(id) && isOAuthButtonId(id)
  );

  if (available.length === 0) return null;

  const safeCallback = callbackUrl.startsWith("/") ? callbackUrl : "/portefeuille";

  return (
    <>
      <div className={styles.divider} aria-hidden="true">
        {t("auth.or")}
      </div>
      <div className={styles.providers}>
        {OAUTH_SIGN_IN_BUTTONS.filter((button) => available.includes(button.id)).map((button) => {
          const Icon = ICONS[button.id];
          return (
            <button
              key={button.id}
              type="button"
              className={`${styles.provider} ${BUTTON_CLASS[button.id]}`}
              disabled={loading !== null}
              aria-busy={loading === button.id}
              onClick={() => {
                setLoading(button.id);
                void signIn(button.id, { callbackUrl: safeCallback });
              }}
            >
              <Icon />
              {loading === button.id ? t("auth.redirecting") : providerLabel(button.id, t)}
            </button>
          );
        })}
      </div>
    </>
  );
}
