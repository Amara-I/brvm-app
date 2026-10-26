// Vérifie que chaque clé française a une traduction anglaise non vide.
// Usage : npm run i18n:check
import { diffMessageKeys } from "../lib/i18n/message-keys";
import { en } from "../lib/i18n/messages/en";
import { fr } from "../lib/i18n/messages/fr";

const issues = diffMessageKeys(fr, en);
if (issues.length === 0) {
  console.log("i18n: clés FR/EN alignées.");
  process.exit(0);
}

for (const issue of issues) {
  console.error(`${issue.problem}\t${issue.path}`);
}
console.error(`i18n: ${issues.length} problème(s).`);
process.exit(1);
