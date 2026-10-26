export type KeyIssue = { path: string; problem: "missing" | "empty" | "untranslated" };

const ALLOW_IDENTICAL = new Set([
  "N/D",
  "OuestBourse",
  "BRVM",
  "FCFA",
  "Screener",
  "Excel",
  "PER",
  "RSI",
  "MACD",
  "Admin",
  "Simulation",
  "Notifications",
  "Source",
]);

export function collectLeaves(tree: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (!tree || typeof tree !== "object") return out;
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object") {
      for (const [child, text] of collectLeaves(value, path)) out.set(child, text);
    }
  }
  return out;
}

/** Clés FR sans équivalent EN, chaînes EN vides, ou longues chaînes identiques oubliées. */
export function diffMessageKeys(fr: unknown, en: unknown): KeyIssue[] {
  const left = collectLeaves(fr);
  const right = collectLeaves(en);
  const issues: KeyIssue[] = [];
  for (const [path, frText] of left) {
    if (!right.has(path)) {
      issues.push({ path, problem: "missing" });
      continue;
    }
    const enText = right.get(path) ?? "";
    if (!enText.trim()) issues.push({ path, problem: "empty" });
    else if (enText === frText && frText.length > 24 && !ALLOW_IDENTICAL.has(frText)) {
      issues.push({ path, problem: "untranslated" });
    }
  }
  for (const path of right.keys()) {
    if (!left.has(path)) issues.push({ path, problem: "missing" });
  }
  return issues;
}
