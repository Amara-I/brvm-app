import { describe, expect, it } from "vitest";
import { parseEducationMarkdown, parseInlineMarkdown, parseLatexPieces } from "./markdown";

describe("parseEducationMarkdown", () => {
  it("sépare titres, tableau, liste et maths display", () => {
    const md = [
      "## Titre",
      "",
      "Un paragraphe avec **gras**.",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "1. Premier",
      "2. Second",
      "",
      "$$",
      "\\text{R} = \\frac{a}{b}",
      "$$",
    ].join("\n");
    const blocks = parseEducationMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "table", "ol", "math"]);
    const table = blocks.find((b) => b.type === "table");
    expect(table?.type === "table" && table.headers).toEqual(["A", "B"]);
    expect(table?.type === "table" && table.rows[0]).toEqual(["1", "2"]);
    const math = blocks.find((b) => b.type === "math");
    expect(math?.type === "math" && math.latex).toContain("frac");
  });

  it("garde un texte sans markdown comme un paragraphe", () => {
    const blocks = parseEducationMarkdown("Simple texte pédagogique.\n\nSecond bloc.");
    expect(blocks).toEqual([
      { type: "p", text: "Simple texte pédagogique." },
      { type: "p", text: "Second bloc." },
    ]);
  });
});

describe("parseInlineMarkdown", () => {
  it("extrait lien, gras et math inline", () => {
    const parts = parseInlineMarkdown(
      "Voir [la fiche](/education/x) et $a+b$ puis **stop**."
    );
    expect(parts.some((p) => p.type === "link" && p.href === "/education/x")).toBe(true);
    expect(parts.some((p) => p.type === "math" && p.latex === "a+b")).toBe(true);
    expect(parts.some((p) => p.type === "strong" && p.text === "stop")).toBe(true);
  });
});

describe("parseLatexPieces", () => {
  it("transforme une fraction KaTeX", () => {
    const pieces = parseLatexPieces("\\text{R} = \\frac{a + b}{c}");
    expect(pieces.some((p) => p.kind === "frac")).toBe(true);
    const frac = pieces.find((p) => p.kind === "frac");
    expect(frac?.kind === "frac" && frac.num.some((n) => n.kind === "text" && n.value.includes("a"))).toBe(
      true
    );
  });
});
