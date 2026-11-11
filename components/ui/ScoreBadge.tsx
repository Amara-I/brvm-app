"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SCORE_TIER_TOKENS, scoreTier, scoreTierLabel } from "@/lib/ui/score-signal-tokens";

type Props = {
  score: number | null | undefined;
  /** Affiche « /100 » après la valeur. */
  outOf?: boolean;
  /** Affiche le palier (Excellent, Bon, Moyen, Faible) à côté du nombre. */
  showTier?: boolean;
  title?: string;
  className?: string;
};

/** Score de qualité (0–100) — même échelle vert → rouge que le signal et la confiance. */
export default function ScoreBadge({ score, outOf = false, showTier = false, title, className }: Props) {
  const { t, locale } = useI18n();
  const tier = scoreTier(score);
  if (tier == null || score == null) return <span className="ob-nd">{t("common.nd")}</span>;
  const tok = SCORE_TIER_TOKENS[tier];
  const tierLabel = scoreTierLabel(tier, locale === "en" ? "en" : "fr");
  const value = Math.round(score);
  const style = { "--ob-fg": tok.fg, "--ob-fg-dark": tok.fgDark, "--ob-bg": tok.bg } as CSSProperties;
  return (
    <span
      className={className ? `ob-score ${className}` : "ob-score"}
      data-tier={tier}
      style={style}
      title={title ?? t("scoreSignal.scoreTitle", { score: value, tier: tierLabel })}
    >
      {value}
      {outOf ? "/100" : ""}
      {showTier ? <span className="ob-score-tier">{tierLabel}</span> : null}
    </span>
  );
}
