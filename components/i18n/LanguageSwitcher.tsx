"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_MAX_AGE, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";
import styles from "./LanguageSwitcher.module.css";

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${LOCALE_MAX_AGE};samesite=lax`;
}

export default function LanguageSwitcher({ landing = false }: { landing?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();

  function select(next: Locale) {
    if (next === locale) return;
    writeLocaleCookie(next);
    document.documentElement.lang = next;
    router.refresh();
  }

  return (
    <div
      className={`${styles.group} ${landing ? styles.groupLanding : ""}`}
      role="group"
      aria-label={t("chrome.lang.label")}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={styles.btn}
          aria-pressed={locale === code}
          onClick={() => select(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
