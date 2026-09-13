// Layout racine — le dashboard réel (reference/BRVM_Dashboard.jsx) est
// branché depuis l'étape 8 via app/page.tsx + components/BrvmDashboardClient.tsx.
// Ajouts étape 9 (checklist de conformité, volet a11y) — STRICTEMENT
// additifs, aucun style/texte du dashboard lui-même n'est modifié :
//   - lien d'évitement ("Aller au contenu principal"), invisible tant qu'il
//     n'a pas le focus clavier (WCAG 2.4.1 Bypass Blocks) ;
//   - `<main>` autour du contenu, cible de ce lien, pour fournir un repère de
//     navigation (landmark) aux lecteurs d'écran.
// Ajout étape 12 (bascule mode clair/sombre) : script bloquant exécuté AVANT
// hydratation (`strategy="beforeInteractive"`) qui pose `data-theme="dark"`
// sur `<html>` si l'utilisateur avait déjà choisi ce thème (`localStorage`) —
// évite un flash de thème clair (par défaut, cf. `app/globals.css`) suivi
// d'un re-bascule brutal en sombre après hydratation. Aucune action requise
// si aucune préférence stockée (le thème clair, valeur par défaut de
// `:root`, s'applique déjà correctement).
import Script from "next/script";
import { Suspense } from "react";
import type { Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./ui.css";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-storage-key";
import { BROWSER_CHROME_BG } from "@/lib/theme/browser-chrome";
import ScrollRestoration from "@/components/navigation/ScrollRestoration";
import AnalyticsBeacon from "@/components/analytics/AnalyticsBeacon";

import { BRAND_NAME } from "@/lib/theme/brand";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const metadata = {
  title: BRAND_NAME,
  description: "Analyse financière des sociétés cotées à la BRVM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BROWSER_CHROME_BG.light,
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",${JSON.stringify(BROWSER_CHROME_BG.dark)});}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <main id="main-content">
          <Suspense fallback={null}>
            <ScrollRestoration />
            <AnalyticsBeacon />
          </Suspense>
          {children}
        </main>
      </body>
    </html>
  );
}
