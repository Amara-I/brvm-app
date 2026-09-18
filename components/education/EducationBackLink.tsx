"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./Education.module.css";

/** Retour : historique navigateur si possible, sinon lien de repli (partage d’URL propre). */
export default function EducationBackLink({
  fallbackHref,
  fallbackLabel,
}: {
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();

  const onBack = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (typeof window === "undefined") return;
      if (window.history.length <= 1) return;
      const ref = document.referrer;
      if (ref) {
        try {
          const u = new URL(ref);
          if (u.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      e.preventDefault();
      router.back();
    },
    [router]
  );

  return (
    <p className={styles.backRow}>
      <Link href={fallbackHref} className={styles.backLink} onClick={onBack}>
        ← {fallbackLabel}
      </Link>
    </p>
  );
}
