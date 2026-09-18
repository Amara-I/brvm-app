"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getScrollContainer,
  isBackForwardNavigation,
  isBrowserReload,
  pageScrollKey,
  restoreScrollPosition,
  saveScrollPosition,
} from "@/lib/ui/scroll-restoration";

const SAVE_DEBOUNCE_MS = 120;

/**
 * Conserve la position de scroll (conteneur principal de l’app, pas window)
 * au rechargement et au retour arrière / avant.
 */
export default function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = pageScrollKey(pathname, searchParams.toString());
  const keyRef = useRef(key);
  const prevKeyRef = useRef(key);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPopRef = useRef(false);

  keyRef.current = key;

  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      try {
        history.scrollRestoration = "manual";
      } catch {
        // ignore
      }
    }

    if (prevKeyRef.current !== key) {
      saveScrollPosition(prevKeyRef.current);
      prevKeyRef.current = key;
    }

    const shouldRestore = pendingPopRef.current || isBrowserReload() || isBackForwardNavigation();
    pendingPopRef.current = false;
    if (shouldRestore) restoreScrollPosition(key);
  }, [key]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restoreScrollPosition(keyRef.current);
    };
    const onBeforeUnload = () => saveScrollPosition(keyRef.current);
    const onPopState = () => {
      pendingPopRef.current = true;
      saveScrollPosition(keyRef.current);
      restoreScrollPosition(keyRef.current);
    };
    const onScroll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveScrollPosition(keyRef.current), SAVE_DEBOUNCE_MS);
    };

    const root = getScrollContainer();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("scroll", onScroll, { passive: true });
    root?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      saveScrollPosition(keyRef.current);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("scroll", onScroll);
      root?.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
