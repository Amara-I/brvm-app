import type { ChartDrawing } from "@/lib/charts/chart-drawings-storage";

export type ZoomSnap = {
  range: { from: number; to: number } | null;
  price: { min: number; max: number } | null;
};

/** Instantané graphique (tracés / zoom) à restaurer via Annuler / Ctrl+Z. */
export type ChartViewUndoEntry =
  | { type: "drawings"; drawings: ChartDrawing[] }
  | { type: "zoom"; zoom: ZoomSnap };

export function cloneDrawings(drawings: ChartDrawing[]): ChartDrawing[] {
  return drawings.map((d) => ({ ...d }));
}

export function cloneZoom(zoom: ZoomSnap): ZoomSnap {
  return {
    range: zoom.range ? { ...zoom.range } : null,
    price: zoom.price ? { ...zoom.price } : null,
  };
}
