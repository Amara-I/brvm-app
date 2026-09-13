import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from "./schemas";

describe("auth schemas", () => {
  it("accepte une inscription valide", () => {
    const parsed = registerSchema.safeParse({
      email: "  User@OuestBourse.test ",
      password: "motdepasse",
      name: "Amara",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("User@OuestBourse.test");
    }
  });

  it("refuse un mot de passe trop court et un email invalide", () => {
    expect(registerSchema.safeParse({ email: "pas-un-email", password: "12345678" }).success).toBe(
      false
    );
    expect(registerSchema.safeParse({ email: "ok@ok.com", password: "1234567" }).success).toBe(false);
  });

  it("valide forgot / reset", () => {
    expect(forgotPasswordSchema.safeParse({ email: "ok@ok.com" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "x".repeat(20), password: "abcdefgh" }).success).toBe(
      true
    );
    expect(resetPasswordSchema.safeParse({ token: "court", password: "abcdefgh" }).success).toBe(false);
  });
});
