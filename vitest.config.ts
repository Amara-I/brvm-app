// Configuration Vitest — étape 10.
// Ajoute la résolution de l'alias `@/*` (déjà défini dans tsconfig.json,
// utilisé par toutes les routes/pages Next.js) pour que les fichiers de test
// qui importent transitivement des modules `lib/`/`app/` utilisant cet alias
// (ex: lib/calc/market-summary-stats.ts → lib/api/companies-full-dataset.ts)
// se résolvent correctement sous Vitest, pas seulement sous Next.js/tsc.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
