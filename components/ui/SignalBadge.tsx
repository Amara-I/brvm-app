"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

type Props = {
  label: "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
  title?: string;
};

/** Pastille de signal — le code français reste dans data-signal (couleurs). */
export default function SignalBadge({ label, title }: Props) {
  const { labels } = useI18n();
  return (
    <span className="ob-signal" data-signal={label} title={title}>
      {labels.signal(label)}
    </span>
  );
}
