import type { TFunc } from "@/lib/i18n/create-i18n";

const SECTOR_KEYS = {
  agriculture: "ngx.sectors.agriculture",
  conglomerates: "ngx.sectors.conglomerates",
  "construction-real-estate": "ngx.sectors.construction-real-estate",
  "consumer-goods": "ngx.sectors.consumer-goods",
  "financial-services": "ngx.sectors.financial-services",
  healthcare: "ngx.sectors.healthcare",
  ict: "ngx.sectors.ict",
  "industrial-goods": "ngx.sectors.industrial-goods",
  investment: "ngx.sectors.investment",
  "natural-resources": "ngx.sectors.natural-resources",
  "oil-and-gas": "ngx.sectors.oil-and-gas",
  services: "ngx.sectors.services",
  utilities: "ngx.sectors.utilities",
  unclassified: "ngx.sectors.unclassified",
  "ngx-unclassified": "ngx.sectors.ngx-unclassified",
} as const;

const BOARD_KEYS = {
  "main-board": "ngx.boards.main-board",
  "premium-board": "ngx.boards.premium-board",
  "growth-board": "ngx.boards.growth-board",
  reit: "ngx.boards.reit",
  "non-interest-finance-board": "ngx.boards.non-interest-finance-board",
} as const;

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ngxSectorLabel(slugOrName: string, fallback: string, t: TFunc): string {
  const key = SECTOR_KEYS[slug(slugOrName) as keyof typeof SECTOR_KEYS] ?? SECTOR_KEYS[slugOrName as keyof typeof SECTOR_KEYS];
  return key ? t(key) : fallback;
}

export function ngxBoardLabel(board: string | null, t: TFunc): string {
  if (!board) return "N/D";
  const key = BOARD_KEYS[slug(board) as keyof typeof BOARD_KEYS];
  return key ? t(key) : board;
}
