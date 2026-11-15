"use client";

// Relecture « douce » des tableaux marché : au plus une fois toutes les
// `intervalMs` (10 min par défaut), suspendue quand l'onglet est masqué.
// Au retour sur l'onglet, la relecture n'a lieu que si la dernière date
// d'au moins `intervalMs` — sinon un simple changement d'onglet relançait
// tout le chargement (trafic base de données facturé).

import { useCallback, useEffect, useRef } from "react";

export const SOFT_REFRESH_MS = 10 * 60_000;
/** Fréquence de vérification (aucun appel réseau tant que la relecture n'est pas due). */
const CHECK_MS = 60_000;

/** Vrai si la dernière relecture date d'au moins `intervalMs`. */
export function isSoftRefreshDue(lastMs: number, nowMs: number, intervalMs: number = SOFT_REFRESH_MS): boolean {
  return nowMs - lastMs >= intervalMs;
}

/**
 * Lance `reload` au plus une fois par `intervalMs`, uniquement onglet visible.
 * Renvoie `markFresh` : à appeler après une actualisation manuelle réussie.
 */
export function useThrottledPoll(
  reload: () => void | Promise<void>,
  intervalMs: number = SOFT_REFRESH_MS
): () => void {
  // Les données initiales (rendu serveur) comptent comme fraîches.
  const lastRef = useRef<number>(Date.now());

  const markFresh = useCallback(() => {
    lastRef.current = Date.now();
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (!isSoftRefreshDue(lastRef.current, now, intervalMs)) return;
      lastRef.current = now;
      void reload();
    };
    const id = window.setInterval(tick, Math.min(CHECK_MS, intervalMs));
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reload, intervalMs]);

  return markFresh;
}
