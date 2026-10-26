"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/components/i18n/I18nProvider";

function ChartLoading() {
  const { t } = useI18n();
  return (
    <p role="status" style={{ margin: "1rem 0", color: "var(--c-textDim)", fontSize: "0.9rem" }}>
      {t("charts.loadingChart")}
    </p>
  );
}

const ChartWorkbench = dynamic(() => import("./ChartWorkbench"), {
  ssr: false,
  loading: () => <ChartLoading />,
});

/** Démarre le téléchargement du chunk workbench (fiche société, avant l'onglet Graphes). */
export function prefetchChartWorkbench(): void {
  if (typeof window === "undefined") return;
  void import("./ChartWorkbench");
}

export default ChartWorkbench;
