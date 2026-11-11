"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SCORE_TIERS } from "@/lib/ui/score-signal-tokens";
import ConfidenceDot from "./ConfidenceDot";
import ScoreBadge from "./ScoreBadge";
import SignalBadge from "./SignalBadge";

/** Légende courte : score (qualité, or / bleu) ≠ signal (timing, vert / ambre / rouge) ≠ confiance (point). */
export default function ScoreSignalLegend({ className }: { className?: string }) {
  const { t } = useI18n();
  const sample: Record<string, number> = { excellent: 75, good: 60, average: 45, weak: 30 };
  return (
    <div className={className ? `ob-legend ${className}` : "ob-legend"} data-testid="score-signal-legend">
      <span className="ob-legend-group" title={t("scoreSignal.legendScoreTitle")}>
        <span className="ob-legend-title">{t("scoreSignal.legendScore")}</span>
        {SCORE_TIERS.map((tier) => (
          <ScoreBadge key={tier.tier} score={sample[tier.tier]} showTier title={t(`scoreSignal.tier.${tier.tier}` as "scoreSignal.tier.good")} />
        ))}
      </span>
      <span className="ob-legend-group" title={t("scoreSignal.legendSignalTitle")}>
        <span className="ob-legend-title">{t("scoreSignal.legendSignal")}</span>
        <SignalBadge label="ACHAT" />
        <SignalBadge label="CONSERVER" />
        <SignalBadge label="VENDRE" />
      </span>
      <span className="ob-legend-group" title={t("scoreSignal.legendConfidenceTitle")}>
        <span className="ob-legend-title">{t("scoreSignal.legendConfidence")}</span>
        <ConfidenceDot value="Élevée" />
        <ConfidenceDot value="Moyenne" />
        <ConfidenceDot value="Faible" />
      </span>
    </div>
  );
}
