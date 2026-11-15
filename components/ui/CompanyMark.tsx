"use client";

import type { CSSProperties } from "react";
import { brvmLogoSrc } from "@/lib/brvm/logo-manifest";
import { ngxLogoSrc } from "@/lib/ngx/logo-manifest";

export type LogoMarket = "BRVM" | "NGX";

/** Initiales affichées en l'absence de logo (deux premiers caractères du ticker). */
export function tickerMonogram(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return t.slice(0, 2) || "?";
}

/** Chemin du logo local, selon le marché. Sans marché, NGX puis BRVM. */
export function companyLogoSrc(ticker: string | null | undefined, market?: LogoMarket): string | null {
  if (market === "BRVM") return brvmLogoSrc(ticker);
  if (market === "NGX") return ngxLogoSrc(ticker);
  return ngxLogoSrc(ticker) ?? brvmLogoSrc(ticker);
}

type Props = {
  ticker: string;
  name?: string;
  /** Taille du tuile (côté), en pixels. */
  size?: number;
  className?: string;
  /** Marché du titre — évite une collision de ticker entre BRVM et NGX. */
  market?: LogoMarket;
};

/**
 * Logo local d'une société dans une tuile claire (lisible sur le thème sombre),
 * ou monogramme si le fichier est absent.
 */
export default function CompanyMark({ ticker, name, size = 24, className, market }: Props) {
  const src = companyLogoSrc(ticker, market);
  const label = name ? `${name} (${ticker})` : ticker;
  const pad = Math.max(2, Math.round(size * 0.08));
  const style: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    padding: src ? pad : 0,
  };
  if (!src) {
    style.fontSize = Math.max(9, Math.round(size * 0.42));
    return (
      <span
        className={["ob-company-mark", "ob-company-monogram", className].filter(Boolean).join(" ")}
        style={style}
        aria-hidden="true"
        title={label}
      >
        {tickerMonogram(ticker)}
      </span>
    );
  }
  return (
    <span className={["ob-company-mark", className].filter(Boolean).join(" ")} style={style} title={label}>
      {/* Le ticker est déjà affiché à côté : alt vide pour éviter la redondance. */}
      <img src={src} alt="" className="ob-company-mark-img" />
    </span>
  );
}
