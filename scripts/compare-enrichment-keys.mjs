import { readFileSync } from "fs";

function extractKeys(file) {
  const t = readFileSync(file, "utf8");
  const keys = new Set();
  for (const m of t.matchAll(/(?:^|\n)\s+(?:["']([a-z0-9-]+)["']|([a-z][a-z0-9-]*))\s*:\s*\{/gm)) {
    const k = m[1] || m[2];
    if (
      ![
        "details",
        "sources",
        "title",
        "url",
        "TermEnrichment",
        "EducationSource",
        "Record",
      ].includes(k)
    ) {
      keys.add(k);
    }
  }
  return [...keys];
}

const inv = JSON.parse(readFileSync("scripts/.education-terms-inventory.json", "utf8")).map(
  (t) => t.slug
);
const p1 = extractKeys("lib/education/enrichments-part1.ts");
const p2 = extractKeys("lib/education/enrichments-part2.ts");
const p3 = extractKeys("lib/education/enrichments-part3.ts");
const all = new Set([...p1, ...p2, ...p3]);

console.log("part1", p1.length);
console.log(p1.join(", "));
console.log("\npart2", p2.length);
console.log(p2.join(", "));
console.log("\npart3", p3.length);
console.log(p3.join(", "));
console.log("\nunique", all.size, "catalog", inv.length);
console.log("\nMISSING", inv.filter((s) => !all.has(s)).join(", ") || "(none)");
console.log("\nEXTRA", [...all].filter((s) => !inv.includes(s)).join(", ") || "(none)");
