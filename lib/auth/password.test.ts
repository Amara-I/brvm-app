import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hache et vérifie un mot de passe avec bcrypt", async () => {
    const hash = await hashPassword("secret-brvm");
    expect(hash).not.toEqual("secret-brvm");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("secret-brvm", hash)).toBe(true);
    expect(await verifyPassword("autre", hash)).toBe(false);
  });
});
