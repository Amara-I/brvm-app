import fs from "node:fs";

export function readCsv<T>(file: string): T[] {
  const text = fs.readFileSync(file, "utf8").replace(/\r/g, "");
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { cur.push(cell); cell = ""; }
    else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
    else cell += ch;
  }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])) as T);
}
