// Manifest PWA : permet d'installer OuestBourse sur l'écran d'accueil du mobile.
import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/theme/brand";
import { BROWSER_CHROME_BG } from "@/lib/theme/browser-chrome";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_TAGLINE,
    id: "/marche",
    start_url: "/marche",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["finance", "business"],
    background_color: BROWSER_CHROME_BG.light,
    theme_color: BROWSER_CHROME_BG.light,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Marché", url: "/marche" },
      { name: "Portefeuille", url: "/portefeuille" },
      { name: "Graphes", url: "/graphes" },
    ],
  };
}
