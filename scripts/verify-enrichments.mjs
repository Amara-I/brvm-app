import { getAllEducationTerms, getTermBySlug } from "../lib/education/catalog";
import { TERM_ENRICHMENTS } from "../lib/education/term-enrichments";

const all = getAllEducationTerms();
const missing = all.filter((t) => !t.details || !t.sources?.length);
console.log("terms", all.length);
console.log("enriched with details+sources", all.filter((t) => t.details && t.sources?.length).length);
console.log("missing enrichment", missing.map((t) => t.slug).join(", ") || "(none)");
console.log("enrichment keys", Object.keys(TERM_ENRICHMENTS).length);

const rsi = getTermBySlug("rsi");
console.log("\nRSI details paras", rsi?.details?.split("\n\n").length);
console.log("RSI sources", rsi?.sources?.length, rsi?.sources?.[0]?.title);

const action = getTermBySlug("action");
console.log("\naction details paras", action?.details?.split("\n\n").length);
console.log("action sources", action?.sources?.map((s) => s.title).join(" | "));
