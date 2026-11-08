"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * État React synchronisé avec sessionStorage — survit au rechargement (F5)
 * de la même page sans toucher au localStorage (préférences globales).
 *
 * La lecture du stockage se fait après le premier rendu, pour que le HTML
 * serveur et le premier rendu client restent identiques (pas d'erreur
 * d'hydratation).
 */
export function usePersistedState<T>(
  storageKey: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initialValue);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      // valeur illisible : on garde la valeur initiale
    }
    setHydratedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // quota / mode privé
    }
  }, [hydratedKey, storageKey, state]);

  return [state, setState];
}
