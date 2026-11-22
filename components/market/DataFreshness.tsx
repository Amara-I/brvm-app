"use client";

// Pastille de fraîcheur des cours. Le rendu serveur n'affiche que la date
// (fuseau UTC fixe) ; l'état « en cours / clôturé / non à jour » dépend de
// l'horloge du navigateur et n'est donc calculé qu'après l'hydratation, pour
// éviter toute erreur d'hydratation React.
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  freshnessExchangeOf,
  marketFreshness,
  type FreshnessState,
} from "@/lib/market/freshness";

const TICK_MS = 60_000;

export default function DataFreshness({
  exchange,
  asOf,
  className,
}: {
  /** Code de place (BRVM, NGX…) ; les autres places n'ont pas d'état de séance. */
  exchange: string | null | undefined;
  /** Date ISO de la dernière synchronisation des cours. */
  asOf: string | null | undefined;
  className?: string;
}) {
  const { t, format } = useI18n();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const market = freshnessExchangeOf(exchange);
  const state: FreshnessState =
    market && now ? marketFreshness({ exchange: market, asOf, now }) : asOf ? "CLOSED" : "UNKNOWN";
  const hydrated = market !== null && now !== null;

  const time = asOf
    ? format.date(asOf, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "";

  const label = !asOf
    ? t("market.freshness.unknown")
    : !hydrated
      ? time
      : state === "LIVE"
        ? t("market.freshness.live", { time })
        : state === "STALE"
          ? t("market.freshness.stale", { time })
          : t("market.freshness.closed", { time });

  return (
    <span
      className={className}
      title={t("market.freshness.hint")}
      data-testid="data-freshness"
      data-state={hydrated ? state : "PENDING"}
    >
      <span className="ob-fresh-dot" data-state={hydrated ? state : "PENDING"} aria-hidden="true" />
      {label}
    </span>
  );
}
