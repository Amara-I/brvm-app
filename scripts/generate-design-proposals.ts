// Script CLI — génère des brouillons de propositions DESIGN (jamais de code app).
// Usage : npm run design:proposals

import { generateDesignProposalsFromFindings } from "../lib/design-agent/generate-proposals";

async function main() {
  console.log("✦ Génération des propositions design (brouillons)…");
  const result = await generateDesignProposalsFromFindings({ limit: 15 });
  console.log(JSON.stringify(result, null, 2));
  if (result.written === 0) {
    console.log(
      "ℹ️  Aucune nouvelle proposition (pas de finding DESIGN/UX « NOUVEAU », ou déjà proposés)."
    );
  } else {
    console.log(`✔ ${result.written} fichier(s) dans docs/design-agent/proposals/`);
    console.log("→ Relire /apercu-design puis valider ou rejeter chaque ID en chat.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
