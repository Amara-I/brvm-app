"use client";

// Filet de sécurité par segment : une exception de rendu n'affiche plus une
// page blanche, elle propose de réessayer. Le `digest` est journalisé pour
// pouvoir retrouver l'erreur dans les logs Vercel (le message détaillé reste
// côté serveur en production).
import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[route-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="ob-page">
      <ErrorState
        title={t("common.errorGeneric")}
        action={
          <button type="button" className="ob-btn" onClick={() => reset()}>
            {t("common.retry")}
          </button>
        }
      />
    </div>
  );
}
