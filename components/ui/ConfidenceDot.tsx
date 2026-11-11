"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { confidenceToken } from "@/lib/ui/score-signal-tokens";

type Props = {
  value: string | null | undefined;
  /** Point seul (dans une pastille) ; sinon point + libellé. */
  compact?: boolean;
};

/** Confiance : un point coloré sur l'échelle verte → rouge, partagée avec le score et le signal. */
export default function ConfidenceDot({ value, compact = false }: Props) {
  const { labels, t } = useI18n();
  const tok = confidenceToken(value);
  if (tok == null) return compact ? null : <span className="ob-nd">{t("common.nd")}</span>;
  const label = labels.confidence(value);
  const style = { "--ob-fg": tok.fg, "--ob-fg-dark": tok.fgDark } as CSSProperties;
  const dot = (
    <span
      className="ob-conf-dot"
      style={style}
      aria-hidden={compact ? undefined : true}
      role={compact ? "img" : undefined}
      aria-label={compact ? t("scoreSignal.confidenceAria", { value: label }) : undefined}
      title={compact ? t("scoreSignal.confidenceAria", { value: label }) : undefined}
    />
  );
  if (compact) return dot;
  return (
    <span className="ob-conf" data-confidence={value ?? undefined}>
      {dot}
      {label}
    </span>
  );
}
