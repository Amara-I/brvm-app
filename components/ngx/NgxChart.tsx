"use client";

import LazyChartWorkbench from "@/components/charts/LazyChartWorkbench";
import type { ChartUniverseItem } from "@/components/charts/ChartWorkbench";

/**
 * Graphe détaillé NGX : le même workbench que la BRVM (périodes et intervalles, indicateurs,
 * outils de tracé, comparaison, échelles % / log, volume, légende OHLC, plein écran), branché
 * sur `/api/ngx/charts/:symbol` (cours en naira, indices NGX comparables).
 *
 * `universe` vient du serveur : sa référence est stable d'un rendu à l'autre, et aucun objet ou
 * tableau n'est recréé ici — le gros effet de TradingChart ne se relance donc pas en boucle.
 */
export default function NgxChart({
  symbol,
  universe,
  isAuthenticated = false,
}: {
  symbol: string;
  universe: ChartUniverseItem[];
  /** Connecté : analyses sauvegardées et alertes de cours (comme sur la BRVM). */
  isAuthenticated?: boolean;
}) {
  return (
    <LazyChartWorkbench
      market="NGX"
      universe={universe}
      initialTicker={symbol}
      embedded
      isAuthenticated={isAuthenticated}
    />
  );
}
