"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeAuthApiMessage } from "./api-message";
import styles from "./AuthForm.module.css";

export default function VerifyEmailBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function resend() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorText(
          typeof json?.error === "string"
            ? localizeAuthApiMessage(json.error, t)
            : t("auth.verify.sendFailed")
        );
        setState("error");
        return;
      }
      if (typeof json?.data?.devVerifyUrl === "string") {
        setDevUrl(json.data.devVerifyUrl);
      }
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.banner} role="status">
      <p>
        {t("auth.verify.banner")}
        {state === "sent" ? ` ${t("auth.verify.resent")}` : null}
        {state === "error" ? ` ${errorText ?? t("auth.verify.sendFailed")}` : null}{" "}
        {devUrl ? (
          <a href={devUrl} className={styles.inlineLink}>
            {t("auth.devLink")}
          </a>
        ) : null}
      </p>
      <button type="button" onClick={() => void resend()} disabled={state === "sending" || state === "sent"}>
        {state === "sending" ? t("auth.sending") : state === "sent" ? t("auth.verify.resentButton") : t("auth.verify.resend")}
      </button>
    </div>
  );
}
