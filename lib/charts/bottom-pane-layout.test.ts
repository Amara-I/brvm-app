import { describe, expect, it } from "vitest";
import { computeBottomPaneLayout, validateBottomPaneLayout } from "./bottom-pane-layout";

describe("computeBottomPaneLayout", () => {
  it("reste valide avec 1 à 7 volets (volume affiché)", () => {
    for (let count = 1; count <= 7; count++) {
      const layout = computeBottomPaneLayout({ bottomPaneCount: count, showVolume: true });
      expect(validateBottomPaneLayout(layout, count)).toBe(true);
      expect(layout.paneShare).toBeLessThanOrEqual(0.461);
    }
  });

  it("reste valide avec 4 volets sans volume", () => {
    const layout = computeBottomPaneLayout({ bottomPaneCount: 4, showVolume: false });
    expect(validateBottomPaneLayout(layout, 4)).toBe(true);
    const m0 = layout.paneMargins(0);
    const m3 = layout.paneMargins(3);
    expect(m0.bottom).toBeLessThan(m3.bottom);
    expect(m0.top).toBeGreaterThan(m3.top);
  });

  it("aucun volet si count = 0", () => {
    const layout = computeBottomPaneLayout({ bottomPaneCount: 0, showVolume: true });
    expect(layout.paneH).toBe(0);
    expect(layout.paneShare).toBe(0);
  });
});
