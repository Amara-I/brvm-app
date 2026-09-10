import { readFileSync, writeFileSync } from "fs";

const text = readFileSync("lib/education/catalog.ts", "utf8");
const after = text.slice(text.indexOf("export const EDUCATION_TERMS"));
const blocks = after.split(/\n  \{\n/).slice(1);

const terms = [];
for (const block of blocks) {
  const slug = block.match(/slug:\s*"([^"]+)"/)?.[1] || block.match(/"slug":\s*"([^"]+)"/)?.[1];
  const title = block.match(/title:\s*"([^"]+)"/)?.[1] || block.match(/"title":\s*"([^"]+)"/)?.[1];
  const definition =
    block.match(/definition:\s*\n\s*"([^"]+)"/)?.[1] ||
    block.match(/definition:\s*"([^"]+)"/)?.[1] ||
    block.match(/"definition":\s*"([^"]+)"/)?.[1];
  const hasDetails = /details:/.test(block);
  if (slug) terms.push({ slug, title, definition: definition?.slice(0, 120), hasDetails });
}

writeFileSync("scripts/.education-terms-inventory.json", JSON.stringify(terms, null, 2));
console.log("terms", terms.length);
console.log("with details", terms.filter((t) => t.hasDetails).length);
console.log(terms.map((t) => t.slug).join(", "));
