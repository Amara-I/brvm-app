/** Répartition verticale des volets d'indicateurs sous le graphique principal. */

export type BottomPaneMargins = { top: number; bottom: number };

export type BottomPaneLayout = {
  paneH: number;
  paneShare: number;
  volumeBand: number;
  mainBottomMargin: number;
  paneMargins: (index: number) => BottomPaneMargins;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Calcule des marges valides (top + bottom < 1) pour N volets empilés depuis le bas.
 * Évite le dépassement de `paneTop > 1` qui faisait planter lightweight-charts au-delà de 3 indicateurs.
 */
export function computeBottomPaneLayout(options: {
  bottomPaneCount: number;
  showVolume: boolean;
}): BottomPaneLayout {
  const { bottomPaneCount, showVolume } = options;
  const volumeBand = showVolume ? 0.1 : 0;
  const maxIndicatorBand = showVolume ? 0.46 : 0.52;

  const paneH =
    bottomPaneCount > 0 ? Math.min(0.12, maxIndicatorBand / bottomPaneCount) : 0;
  const paneShare = paneH * bottomPaneCount;
  const mainBottomMargin = volumeBand + paneShare + (showVolume ? 0.04 : 0.02);

  function paneMargins(index: number): BottomPaneMargins {
    if (bottomPaneCount <= 0 || paneH <= 0) {
      return { top: 0.9, bottom: 0 };
    }
    const i = clamp(index, 0, bottomPaneCount - 1);
    const bottom = volumeBand + i * paneH;
    const top = 1 - volumeBand - (i + 1) * paneH;
    const safeTop = clamp(top, 0, 0.995);
    const safeBottom = clamp(bottom, 0, 0.995);
    if (safeTop + safeBottom >= 1 || safeTop <= safeBottom) {
      const bandTop = volumeBand + (bottomPaneCount - 1 - i) * paneH;
      const bandBottom = volumeBand + i * paneH;
      return {
        top: clamp(1 - bandBottom - paneH, 0, 0.995),
        bottom: clamp(bandBottom, 0, 0.995),
      };
    }
    return { top: safeTop, bottom: safeBottom };
  }

  return { paneH, paneShare, volumeBand, mainBottomMargin, paneMargins };
}

/** Vérifie que chaque volet a des marges utilisables par lightweight-charts. */
export function validateBottomPaneLayout(layout: BottomPaneLayout, count: number): boolean {
  for (let i = 0; i < count; i++) {
    const { top, bottom } = layout.paneMargins(i);
    if (top < 0 || bottom < 0 || top > 1 || bottom > 1) return false;
    if (top + bottom >= 1) return false;
  }
  return true;
}
