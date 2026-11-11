"use client";

import type { CSSProperties } from "react";
import { ngxLogoSrc } from "@/lib/ngx/logo-manifest";

/** Initiales affichées en l'absence de logo (deux premiers caractères du ticker). */
export function tickerMonogram(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return t.slice(0, 2) || "?";
}

type Props = {
  ticker: string;
  name?: string;
  /** Taille du côté, en pixels. */
  size?: number;
  className?: string;
};

/** Logo local d'une société NGX, ou monogramme si le fichier est absent. */
export default function CompanyMark({ ticker, name, size = 20, className }: Props) {
  const src = ngxLogoSrc(ticker);
  const label = name ? `${name} (${ticker})` : ticker;
  const classes = ["ob-company-mark", !src ? "ob-company-monogram" : "", className].filter(Boolean).join(" ");
  const style: CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };
  if (!src) style.fontSize = Math.max(9, Math.round(size * 0.42));
  if (src) {
    return (
      // Le ticker est déjà affiché à côté : alt vide pour éviter la redondance.
      <img src={src} alt="" width={size} height={size} className={classes} style={style} title={label} />
    );
  }
  return (
    <span className={classes} style={style} aria-hidden="true" title={label}>
      {tickerMonogram(ticker)}
    </span>
  );
}
