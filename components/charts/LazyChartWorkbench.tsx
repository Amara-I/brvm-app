"use client";

import dynamic from "next/dynamic";

const ChartWorkbench = dynamic(() => import("./ChartWorkbench"), {
  ssr: false,
  loading: () => (
    <p role="status" style={{ margin: "1rem 0", color: "var(--c-textDim)", fontSize: "0.9rem" }}>
      Chargement du graphique…
    </p>
  ),
});

/** Démarre le téléchargement du chunk workbench (fiche société, avant l'onglet Graphes). */
export function prefetchChartWorkbench(): void {
  if (typeof window === "undefined") return;
  void import("./ChartWorkbench");
}

export default ChartWorkbench;
