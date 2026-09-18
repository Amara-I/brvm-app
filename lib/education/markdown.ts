/**
 * Sous-ensemble Markdown pédagogique (GFM tables, listes, titres, maths KaTeX).
 * Pas un parseur CommonMark complet — suffisant pour les fiches Éducation.
 */

export type MdBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "math"; latex: string }
  | { type: "hr" };

export type MdInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "math"; latex: string };

export function parseEducationMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      i += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("$$")) {
      const sameLine = trimmed.slice(2);
      if (sameLine.includes("$$")) {
        const latex = sameLine.replace(/\$\$$/, "").trim();
        blocks.push({ type: "math", latex });
        i += 1;
        continue;
      }
      const buf: string[] = [];
      if (sameLine.trim()) buf.push(sameLine.trim());
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().endsWith("$$")) {
        buf.push((lines[i] ?? "").trim());
        i += 1;
      }
      if (i < lines.length) {
        const last = (lines[i] ?? "").trim().replace(/\$\$$/, "").trim();
        if (last) buf.push(last);
        i += 1;
      }
      blocks.push({ type: "math", latex: buf.join(" ").trim() });
      continue;
    }

    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        tableLines.push((lines[i] ?? "").trim());
        i += 1;
      }
      const parsed = parseTable(tableLines);
      if (parsed) blocks.push(parsed);
      continue;
    }

    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*] /, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\. /, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (!next) break;
      if (
        next.startsWith("## ") ||
        next.startsWith("### ") ||
        next.startsWith("|") ||
        next.startsWith("$$") ||
        next === "---" ||
        /^[-*] /.test(next) ||
        /^\d+\. /.test(next)
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

function parseTable(lines: string[]): Extract<MdBlock, { type: "table" }> | null {
  const split = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const body = lines.filter((l) => !/^\|?\s*:?-{3,}/.test(l));
  if (body.length < 1) return null;
  const headers = split(body[0]!);
  const rows = body.slice(1).map(split);
  return { type: "table", headers, rows };
}

export function parseInlineMarkdown(text: string): MdInline[] {
  const out: MdInline[] = [];
  const re =
    /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      out.push({ type: "math", latex: token.slice(2, -2).trim() });
    } else if (token.startsWith("$") && token.endsWith("$")) {
      out.push({ type: "math", latex: token.slice(1, -1).trim() });
    } else if (token.startsWith("**")) {
      out.push({ type: "strong", text: token.slice(2, -2) });
    } else if (token.startsWith("*")) {
      out.push({ type: "em", text: token.slice(1, -1) });
    } else if (token.startsWith("`")) {
      out.push({ type: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) out.push({ type: "link", text: lm[1]!, href: lm[2]! });
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.length > 0 ? out : [{ type: "text", text }];
}

/** Fragments visuels pour un sous-ensemble KaTeX (fractions, texte, opérateurs). */
export type LatexPiece =
  | { kind: "text"; value: string }
  | { kind: "frac"; num: LatexPiece[]; den: LatexPiece[] };

export function parseLatexPieces(src: string): LatexPiece[] {
  let s = src
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\mathrm\{([^{}]*)\}/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\%/g, "%")
    .replace(/\\,/g, " ")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\quad/g, "  ")
    .replace(/~/g, " ");

  const out: LatexPiece[] = [];
  const fracRe = /\\frac\{([^{}]+)\}\{([^{}]+)\}/;
  while (s.length > 0) {
    const idx = s.search(fracRe);
    if (idx === -1) {
      if (s) out.push({ kind: "text", value: s.replace(/[{}]/g, "") });
      break;
    }
    if (idx > 0) out.push({ kind: "text", value: s.slice(0, idx).replace(/[{}]/g, "") });
    const m = s.slice(idx).match(fracRe);
    if (!m) break;
    out.push({
      kind: "frac",
      num: parseLatexPieces(m[1]!),
      den: parseLatexPieces(m[2]!),
    });
    s = s.slice(idx + m[0].length);
  }
  return out;
}
