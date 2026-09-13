"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import styles from "./SignOutButton.module.css";

type Props = {
  className?: string;
  /** Masque le bouton déclencheur (ex. menu compte qui ouvre le dialogue). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

function fallbackSignOut() {
  const url = `/api/auth/signout?callbackUrl=${encodeURIComponent("/")}`;
  window.location.assign(url);
}

export default function SignOutButton({ className, open, onOpenChange, hideTrigger }: Props) {
  const titleId = useId();
  const descId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;

  function setDialogOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        if (!isControlled) setInternalOpen(false);
        onOpenChange?.(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [dialogOpen, busy, isControlled, onOpenChange]);

  async function confirmSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut({ callbackUrl: "/", redirect: true });
      window.setTimeout(fallbackSignOut, 1500);
    } catch {
      fallbackSignOut();
    }
  }

  const dialog =
    dialogOpen && mounted
      ? createPortal(
          <div
            className={styles.overlay}
            role="presentation"
            onClick={() => {
              if (!busy) setDialogOpen(false);
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
              <p className={styles.kicker}>Compte</p>
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
                  onClick={() => setDialogOpen(false)}
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          className={className}
          onClick={() => setDialogOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={dialogOpen}
        >
          Déconnexion
        </button>
      )}
      {dialog}
    </>
  );
}
