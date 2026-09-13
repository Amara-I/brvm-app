"use client";

import { useEffect } from "react";
import {
  applyBrowserChromeColor,
  BROWSER_CHROME_BG,
  browserChromeColor,
} from "@/lib/theme/browser-chrome";

/** Pose `data-canvas="landing"` pour que html/body restent charbon (pas un cadre clair). */
export default function LandingCanvas() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-canvas", "landing");
    applyBrowserChromeColor(BROWSER_CHROME_BG.landing);
    return () => {
      root.removeAttribute("data-canvas");
      const theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyBrowserChromeColor(browserChromeColor(theme, null));
    };
  }, []);
  return null;
}
