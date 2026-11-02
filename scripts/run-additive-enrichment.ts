// npm run history:additive -- --exchange=BRVM --kind=history --from=2006-01-01 --limit=2
// Simulation par défaut. Écriture : --apply=1 ET INGESTION_ADDITIVE_ENABLED=true, sur base autorisée uniquement.
import { enrichmentSchema } from "../lib/ingestion/additive/plan";
import { runAdditiveEnrichment } from "../lib/ingestion/additive/run";
const options = enrichmentSchema.parse(Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("="); return [key, value.join("=")];
})));
if (options.apply === "1" && process.env.INGESTION_ADDITIVE_ENABLED !== "true") throw new Error("Écriture non activée explicitement");
runAdditiveEnrichment(options).then((result) => { console.log(JSON.stringify(result, null, 2)); process.exitCode = result.failed ? 1 : 0; }).catch(() => { console.error("Échec du rattrapage ; vérifier les accès réseau/base et les logs protégés."); process.exitCode = 1; });
