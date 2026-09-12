"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flushClientEvents, trackFeatureClick, trackPageView } from "./track-client";

/** Capture pages vues + clics `[data-analytics-feature]` sans PII. */
export default function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname || "/");
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[data-analytics-feature]");
      if (!(el instanceof HTMLElement)) return;
      const feature = el.getAttribute("data-analytics-feature");
      if (!feature) return;
      const action = el.getAttribute("data-analytics-action") ?? "click";
      trackFeatureClick(feature, action, pathname || window.location.pathname);
    }

    function onHide() {
      flushClientEvents();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onHide);
      flushClientEvents();
    };
  }, [pathname]);

  return null;
}
