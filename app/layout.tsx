// Layout racine — le dashboard réel (reference/BRVM_Dashboard.jsx) est
// branché depuis l'étape 8 via app/page.tsx + components/BrvmDashboardClient.tsx.
// Ajouts étape 9 (checklist de conformité, volet a11y) — STRICTEMENT
// additifs, aucun style/texte du dashboard lui-même n'est modifié :
//   - lien d'évitement ("Aller au contenu principal"), invisible tant qu'il
//     n'a pas le focus clavier (WCAG 2.4.1 Bypass Blocks) ;
//   - `<main>` autour du contenu, cible de ce lien, pour fournir un repère de
//     navigation (landmark) aux lecteurs d'écran.
import "./globals.css";

export const metadata = {
  title: "BRVM App",
  description: "Analyse financière des sociétés cotées à la BRVM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
