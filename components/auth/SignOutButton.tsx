"use client";

import { useEffect, useId, useState } from "react";
import { signOut } from "next-auth/react";
import styles from "./SignOutButton.module.css";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function confirmSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Déconnexion
      </button>

      {open ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className={styles.title}>
              Déconnexion
            </h2>
            <p id={descId} className={styles.body}>
              Voulez-vous vraiment vous déconnecter ?
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy}
                onClick={() => void confirmSignOut()}
              >
                {busy ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
