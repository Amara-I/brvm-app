"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/** Exported for unit tests — Échap ferme le panneau. */
export function isMegaMenuDismissKey(key: string): boolean {
  return key === "Escape";
}

/** Exported for unit tests — clic hors du wrapper. */
export function isOutsideNode(
  root: { contains(node: Node): boolean } | null,
  target: EventTarget | null,
): boolean {
  if (!root || target == null) return true;
  return !root.contains(target as Node);
}

/**
 * Disclosure (clic) pour les méga-menus de nav.
 * Ouverture = clic / Entrée / Espace sur le déclencheur (bouton natif).
 * Fermeture = second clic, clic extérieur, Échap (focus rendu au déclencheur).
 * Pas d'ouverture au survol : requis pour le tactile et la barre latérale.
 */
export function useMegaMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isMegaMenuDismissKey(event.key)) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (isOutsideNode(wrapperRef.current, event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return { open, close, toggle, wrapperRef, triggerRef, panelId };
}
