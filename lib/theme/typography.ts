import type { CSSProperties } from "react";
import { C } from "@/lib/theme/colors";

const centeredBlock: CSSProperties = {
  textAlign: "center",
  marginLeft: "auto",
  marginRight: "auto",
};

/** Titres de page (h1) — grands, centrés. */
export const PAGE_TITLE: CSSProperties = {
  ...centeredBlock,
  color: C.text,
  fontSize: "var(--fs-page-title)",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1.12,
  marginTop: 0,
  marginBottom: 12,
};

/** Sous-titre / chapô sous le titre de page. */
export const PAGE_LEAD: CSSProperties = {
  ...centeredBlock,
  color: C.textDim,
  fontSize: "var(--fs-page-lead)",
  lineHeight: 1.65,
  marginTop: 0,
  marginBottom: 28,
  maxWidth: "100%",
};

/** Titre hero marketing (page invité portefeuille, etc.). */
export const HERO_TITLE: CSSProperties = {
  ...PAGE_TITLE,
  fontSize: "var(--fs-hero-title)",
  marginBottom: 16,
  maxWidth: "100%",
};

/** Titre de section (h2) dans les pages. */
export const SECTION_TITLE: CSSProperties = {
  ...centeredBlock,
  color: C.gold,
  fontSize: "var(--fs-section)",
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 12,
};

/** Corps de texte dans un panneau (légende, description). */
export const PANEL_TEXT: CSSProperties = {
  color: C.textDim,
  fontSize: "var(--fs-body-sm)",
  lineHeight: 1.65,
};
