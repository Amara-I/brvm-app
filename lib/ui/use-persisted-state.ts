"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * État React synchronisé avec sessionStorage — survit au rechargement (F5)
 * de la même page sans toucher au localStorage (préférences globales).
 */
export function usePersistedState<T>(
  storageKey: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // quota / mode privé
    }
  }, [storageKey, state]);

  return [state, setState];
}
