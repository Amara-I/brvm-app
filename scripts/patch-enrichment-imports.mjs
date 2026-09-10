import { readFileSync, writeFileSync } from "fs";

for (const f of [
  "lib/education/enrichments-part1.ts",
  "lib/education/enrichments-part2.ts",
  "lib/education/enrichments-part3.ts",
]) {
  let t = readFileSync(f, "utf8");
  t = t.replace(/import type \{ EducationSource \} from "\.\/catalog";\r?\n\r?\n/, "");
  t = t.replace(/sources: EducationSource\[\]/g, "sources: { title: string; url: string }[]");
  writeFileSync(f, t);
  console.log("patched", f);
}
