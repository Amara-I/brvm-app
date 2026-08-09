// ═══════════════════════════════════════════════════════════════════════════
// Clé localStorage de la bascule mode clair/sombre — étape 12
// ═══════════════════════════════════════════════════════════════════════════
// Extraite dans son propre fichier SANS directive "use client" : importer
// cette constante (une simple chaîne) depuis `components/theme/ThemeToggle.tsx`
// (Client Component) ne pose pas de problème, mais l'importer depuis
// `app/layout.tsx` (Server Component, pour construire le script bloquant
// anti-flash) échouait silencieusement — Next.js transforme TOUS les exports
// d'un module marqué "use client" en références client opaques dès qu'ils
// sont lus côté serveur, même une simple chaîne. Résultat observé : le script
// généré contenait `localStorage.getItem({})` au lieu de
// `localStorage.getItem("ouestbourse-theme")` (bug réel constaté et corrigé
// lors des tests en conditions réelles de cette étape). Un module neutre,
// importable des deux côtés sans transformation, règle le problème.
// ═══════════════════════════════════════════════════════════════════════════

export const THEME_STORAGE_KEY = "ouestbourse-theme";
