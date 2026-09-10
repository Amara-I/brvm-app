import { readFileSync } from "fs";

const text = readFileSync("lib/education/catalog.ts", "utf8");
const iface = text.match(/export interface EducationTerm \{[\s\S]*?\n\}/)?.[0] ?? "";
console.log("--- interface ---");
console.log(iface);

const termBlocks = [...text.matchAll(/\{\s*\n(?:[^{}]|\n)*?"slug":\s*"([^"]+)"[\s\S]*?\n\s*\},?/g)];
// fallback simpler
const slugs = [...text.matchAll(/"slug":\s*"([^"]+)"/g)].map((m) => m[1]);
const termSlugs = [];
const themeSlugs = new Set();
const catSlugs = new Set();
// crude: after EDUCATION_TERMS
const idx = text.indexOf("export const EDUCATION_TERMS");
const after = text.slice(idx);
const termSlugMatches = [...after.matchAll(/^\s+"slug":\s*"([^"]+)"/gm)].map((m) => m[1]);
console.log("\nterm count", termSlugMatches.length);
console.log(termSlugMatches.join(", "));

const withDetails = (after.match(/details:/g) || []).length;
const withSources = (after.match(/sources:/g) || []).length;
console.log("\ndetails fields", withDetails, "sources fields", withSources);
