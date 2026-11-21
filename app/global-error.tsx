"use client";

// Dernier recours : erreur dans le layout racine lui-même. Ce composant
// remplace le <html>, donc il ne peut dépendre ni du provider i18n ni du
// thème — texte bilingue minimal, styles en ligne.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
          padding: 24,
        }}
      >
        <div role="alert">
          <h1 style={{ fontSize: "1.25rem" }}>Une erreur est survenue · Something went wrong</h1>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
          >
            Réessayer · Retry
          </button>
        </div>
      </body>
    </html>
  );
}
