"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { confidenceOpacity } from "@/lib/ui/score-signal-tokens";

type Props = {
  value: string | null | undefined;
  /** Point seul (dans une pastille) ; sinon point + libellé. */
  compact?: boolean;
};

/** Confiance : un point plus ou moins opaque, sans couleur de signal ni de score. */
export default function ConfidenceDot({ value, compact = false }: Props) {
  const { labels, t } = useI18n();
  const opacity = confidenceOpacity(value);
  if (opacity == null) return compact ? null : <span className="ob-nd">{t("common.nd")}</span>;
  const label = labels.confidence(value);
  const dot = (
    <span
      className="ob-conf-dot"
      style={{ opacity }}
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
