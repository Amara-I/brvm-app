import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/trim-logo-assets.py");

function pythonBin(): string {
  const candidates = [
    "/tmp/logo-venv/bin/python",
    path.resolve(__dirname, "../../../.logo-venv/bin/python"),
    "python3",
  ];
  for (const c of candidates) {
    if (c === "python3" || existsSync(c)) return c;
  }
  return "python3";
}

describe("logo asset coverage", () => {
  it("every BRVM and NGX logo fills at least 60% of the width or height", () => {
    const result = execFileSync(pythonBin(), [SCRIPT, "--check"], { encoding: "utf8" });
    expect(result).toMatch(/^OK:/);
  });
});
