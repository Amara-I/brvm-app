"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isBrowserReload,
  pageScrollKey,
  restoreScrollPosition,
  saveScrollPosition,
} from "@/lib/ui/scroll-restoration";

const SAVE_DEBOUNCE_MS = 120;

/**
 * Conserve la position de scroll lors d'un rechargement navigateur (F5)
 * et enregistre en continu la position courante pour chaque URL.
 */
export default function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = pageScrollKey(pathname, searchParams.toString());
  const keyRef = useRef(key);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  keyRef.current = key;

  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      try {
        history.scrollRestoration = "manual";
      } catch {
        // ignore
      }
    }

    if (isBrowserReload()) {
      restoreScrollPosition(key);
    }
  }, [key]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restoreScrollPosition(keyRef.current);
    };
    const onBeforeUnload = () => saveScrollPosition(keyRef.current);
    const onScroll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveScrollPosition(keyRef.current), SAVE_DEBOUNCE_MS);
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
