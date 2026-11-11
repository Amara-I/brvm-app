"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SIGNAL_TOKENS, type SignalLabel } from "@/lib/ui/score-signal-tokens";
import ConfidenceDot from "./ConfidenceDot";

type Props = {
  label: SignalLabel;
  title?: string;
  /** Confiance du signal : point coloré dans la pastille (vert / ambre / rouge). */
  confidence?: string | null;
};

/** Pastille de signal (timing) — même échelle vert → rouge que le score, avec icône. */
export default function SignalBadge({ label, title, confidence }: Props) {
  const { labels } = useI18n();
  const tok = SIGNAL_TOKENS[label];
  const style = tok
    ? ({ "--ob-fg": tok.fg, "--ob-fg-dark": tok.fgDark, "--ob-bg": tok.bg } as CSSProperties)
    : undefined;
  return (
    <span className="ob-signal" data-signal={label} data-family={tok?.family} title={title} style={style}>
      {tok ? (
        <span className="ob-signal-icon" aria-hidden="true">
          {tok.icon}
        </span>
      ) : null}
      {labels.signal(label)}
      {confidence ? <ConfidenceDot value={confidence} compact /> : null}
    </span>
  );
}
