import { describe, expect, it } from "vitest";
import { buildAuthLink, getAppBaseUrl } from "./app-url";

describe("getAppBaseUrl", () => {
  it("privilégie NEXTAUTH_URL sans slash final", () => {
    expect(getAppBaseUrl({ NEXTAUTH_URL: "https://brwm-app.vercel.app/" })).toBe(
      "https://brwm-app.vercel.app"
    );
  });

  it("utilise VERCEL_URL en https si NEXTAUTH_URL est absent", () => {
    expect(getAppBaseUrl({ VERCEL_URL: "brwm-app.vercel.app" })).toBe("https://brwm-app.vercel.app");
  });

  it("retombe sur localhost", () => {
    expect(getAppBaseUrl({})).toBe("http://localhost:3000");
  });
});

describe("buildAuthLink", () => {
  it("place le jeton en query string", () => {
    const url = buildAuthLink("/verifier-email", "abc+token", {
      NEXTAUTH_URL: "https://brwm-app.vercel.app",
    });
    expect(url).toBe("https://brwm-app.vercel.app/verifier-email?token=abc%2Btoken");
  });
});
