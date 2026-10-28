import path from "node:path";

/** Répertoire de travail du chargeur (hors dépôt). Surchargeable via NGX_STAGE_ROOT. */
export const STAGE_ROOT = process.env.NGX_STAGE_ROOT || "/workspace/ngx-reports";
export const DOCS_DIR = path.join(STAGE_ROOT, "docs");
export const STAGED_DIR = path.join(STAGE_ROOT, "staged");
export const MANIFEST_PATH = path.join(STAGED_DIR, "manifest.json");
export const DIRECTORY_PATH = path.join(STAGED_DIR, "company_directory.json");
export const EXTRACTED_DIR = path.join(STAGED_DIR, "extracted");

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);

export function tickerFilter(): string[] | null {
  const t = arg("tickers");
  return t ? t.split(",").map((s) => s.trim().toUpperCase()) : null;
}
