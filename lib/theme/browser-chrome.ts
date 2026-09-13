// Couleurs du chrome navigateur (theme-color / zones sûres).
// Hex figés — le <meta name="theme-color"> n'accepte pas les var() CSS.
// Alignées sur --c-bg (clair / sombre) et --lp-bg (landing, toujours sombre).

export const BROWSER_CHROME_BG = {
  light: "#eef1ec",
  dark: "#080b12",
  landing: "#05070b",
} as const;

export type BrowserChromeSurface = keyof typeof BROWSER_CHROME_BG;

export function browserChromeColor(
  theme: "light" | "dark",
  canvas: BrowserChromeSurface | null | undefined
): string {
  if (canvas === "landing") return BROWSER_CHROME_BG.landing;
  return theme === "dark" ? BROWSER_CHROME_BG.dark : BROWSER_CHROME_BG.light;
}

export function applyBrowserChromeColor(color: string): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}
