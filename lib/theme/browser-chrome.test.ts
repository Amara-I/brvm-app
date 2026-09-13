import { describe, expect, it } from "vitest";
import { BROWSER_CHROME_BG, browserChromeColor } from "./browser-chrome";

describe("browserChromeColor", () => {
  it("peint le canvas landing en charbon, quel que soit le thème", () => {
    expect(browserChromeColor("light", "landing")).toBe(BROWSER_CHROME_BG.landing);
    expect(browserChromeColor("dark", "landing")).toBe(BROWSER_CHROME_BG.landing);
  });

  it("suit le thème hors landing", () => {
    expect(browserChromeColor("light", null)).toBe(BROWSER_CHROME_BG.light);
    expect(browserChromeColor("dark", undefined)).toBe(BROWSER_CHROME_BG.dark);
  });
});
