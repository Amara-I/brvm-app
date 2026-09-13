"use client";

import { useState } from "react";
import styles from "./AuthForm.module.css";

export default function VerifyEmailBanner() {
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
        setErrorText(typeof json?.error === "string" ? json.error : "L’envoi a échoué — réessayez dans un instant.");
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
        Confirmez votre adresse email pour sécuriser votre compte. Consultez votre boîte de réception
        (et les indésirables).
        {state === "sent" ? " Un nouveau lien vient d’être envoyé." : null}
        {state === "error" ? ` ${errorText ?? "L’envoi a échoué — réessayez dans un instant."}` : null}{" "}
        {devUrl ? (
          <a href={devUrl} className={styles.inlineLink}>
            Lien de développement
          </a>
        ) : null}
      </p>
      <button type="button" onClick={() => void resend()} disabled={state === "sending" || state === "sent"}>
        {state === "sending" ? "Envoi…" : state === "sent" ? "Email renvoyé" : "Renvoyer l’email"}
      </button>
    </div>
  );
}
