import type { CSSProperties } from "react";
import { C } from "@/lib/theme/colors";

/** Titres de page (h1) — alignés à gauche, échelle produit (pas marketing). */
export const PAGE_TITLE: CSSProperties = {
  color: C.text,
  fontSize: "var(--fs-page-title)",
  fontWeight: 650,
  letterSpacing: "-0.03em",
  lineHeight: 1.15,
  marginTop: 0,
  marginBottom: 8,
  textAlign: "start",
};

/** Sous-titre / chapô sous le titre de page. */
export const PAGE_LEAD: CSSProperties = {
  color: C.textDim,
  fontSize: "var(--fs-page-lead)",
  lineHeight: 1.55,
  marginTop: 0,
  marginBottom: 24,
  maxWidth: "42rem",
  textAlign: "start",
};

/** Titre hero marketing (landing, page invité portefeuille). */
export const HERO_TITLE: CSSProperties = {
  ...PAGE_TITLE,
  fontSize: "var(--fs-hero-title)",
  marginBottom: 16,
  maxWidth: "100%",
};

/** Titre de section (h2) dans les pages. */
export const SECTION_TITLE: CSSProperties = {
  color: C.text,
  fontSize: "var(--fs-section)",
  fontWeight: 650,
  marginTop: 0,
  marginBottom: 12,
  textAlign: "start",
};

/** Corps de texte dans un panneau (légende, description). */
export const PANEL_TEXT: CSSProperties = {
  color: C.textDim,
  fontSize: "var(--fs-body-sm)",
  lineHeight: 1.55,
};
