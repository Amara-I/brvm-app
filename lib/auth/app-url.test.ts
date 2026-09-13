import { describe, expect, it } from "vitest";
import {
  buildAuthLink,
  getAppBaseUrl,
  isValidAppBaseUrl,
  resolveAuthRedirectUrl,
} from "./app-url";

describe("isValidAppBaseUrl", () => {
  it("accepte une URL http(s) absolue", () => {
    expect(isValidAppBaseUrl("https://brwm-app.vercel.app")).toBe(true);
    expect(isValidAppBaseUrl("http://localhost:3000/")).toBe(true);
  });

  it("rejette un schéma seul ou une ligne d'env collée comme valeur", () => {
    expect(isValidAppBaseUrl("https")).toBe(false);
    expect(isValidAppBaseUrl("https:")).toBe(false);
    expect(isValidAppBaseUrl("https://")).toBe(false);
    expect(isValidAppBaseUrl("NEXTAUTH_URL=https")).toBe(false);
    expect(isValidAppBaseUrl("NEXTAUTH_URL=https://brwm-app.vercel.app")).toBe(false);
    expect(isValidAppBaseUrl("AUTH_URL=https://example.com")).toBe(false);
  });
});

describe("getAppBaseUrl", () => {
  it("privilégie NEXTAUTH_URL sans slash final", () => {
    expect(getAppBaseUrl({ NEXTAUTH_URL: "https://brwm-app.vercel.app/" })).toBe(
      "https://brwm-app.vercel.app"
    );
  });

  it("ignore NEXTAUTH_URL / AUTH_URL invalides et retombe sur VERCEL_URL", () => {
    expect(
      getAppBaseUrl({
        NEXTAUTH_URL: "NEXTAUTH_URL=https://brwm-app.vercel.app",
        AUTH_URL: "https",
        VERCEL_URL: "brwm-app.vercel.app",
      })
    ).toBe("https://brwm-app.vercel.app");
  });

  it("ignore un NEXTAUTH_URL invalide et utilise AUTH_URL s'il est valide", () => {
    expect(
      getAppBaseUrl({
        NEXTAUTH_URL: "NEXTAUTH_URL=https",
        AUTH_URL: "https://brwm-app.vercel.app",
      })
    ).toBe("https://brwm-app.vercel.app");
  });

  it("utilise VERCEL_URL en https si NEXTAUTH_URL est absent", () => {
    expect(getAppBaseUrl({ VERCEL_URL: "brwm-app.vercel.app" })).toBe("https://brwm-app.vercel.app");
  });

  it("retombe sur localhost", () => {
    expect(getAppBaseUrl({})).toBe("http://localhost:3000");
  });
});

describe("resolveAuthRedirectUrl", () => {
  it("préfixe un chemin relatif avec une base NextAuth valide", () => {
    expect(resolveAuthRedirectUrl("/", "https://brwm-app.vercel.app")).toBe(
      "https://brwm-app.vercel.app/"
    );
  });

  it("n'utilise pas une base NextAuth cassée (ligne d'env collée)", () => {
    expect(
      resolveAuthRedirectUrl("/", "NEXTAUTH_URL=https", {
        VERCEL_URL: "brwm-app.vercel.app",
      })
    ).toBe("https://brwm-app.vercel.app/");
  });

  it("garde un callback absolu de même origine que la base saine", () => {
    expect(
      resolveAuthRedirectUrl("https://brwm-app.vercel.app/", "https://brwm-app.vercel.app")
    ).toBe("https://brwm-app.vercel.app/");
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
