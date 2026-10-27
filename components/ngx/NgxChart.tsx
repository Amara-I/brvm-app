"use client";

import TradingChart from "@/components/charts/TradingChart";
import type { ChartClosePoint } from "@/lib/charts/indicators";

export default function NgxChart({
  storageKey,
  series,
}: {
  storageKey: string;
  series: ChartClosePoint[];
}) {
  return (
    <TradingChart
      ticker={storageKey}
      series={series}
      fullSeries={series}
      showVolume
      height={520}
    />
  );
}
