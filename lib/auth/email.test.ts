import { describe, expect, it } from "vitest";
import { buildAuthEmail, getEmailFrom, isDevAuthPreviewEnabled, isEmailConfigured } from "./email";

describe("email config", () => {
  it("détecte Resend ou SMTP", () => {
    expect(isEmailConfigured({})).toBe(false);
    expect(isEmailConfigured({ RESEND_API_KEY: "re_test" })).toBe(true);
    expect(isEmailConfigured({ EMAIL_SERVER: "smtp://localhost:1025" })).toBe(true);
    expect(isEmailConfigured({ EMAIL_SERVER_HOST: "smtp.exemple.com" })).toBe(true);
  });

  it("compose l'expéditeur", () => {
    expect(getEmailFrom({ EMAIL_FROM: "OuestBourse <a@b.c>" })).toBe("OuestBourse <a@b.c>");
    expect(getEmailFrom({})).toContain("OuestBourse");
  });

  it("n'expose les liens de preview qu'hors production", () => {
    expect(isDevAuthPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDevAuthPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("buildAuthEmail", () => {
  it("rédige un email de confirmation en français", () => {
    const mail = buildAuthEmail("verify", "user@example.com", "tok_verify");
    expect(mail.subject).toContain("Confirmez");
    expect(mail.text).toContain("user@example.com");
    expect(mail.text).toContain("/verifier-email?token=tok_verify");
    expect(mail.html).toContain("Confirmer mon email");
  });

  it("rédige un email de reset en français", () => {
    const mail = buildAuthEmail("reset", "user@example.com", "tok_reset");
    expect(mail.subject).toContain("Réinitialisation");
    expect(mail.text).toContain("/reinitialiser-mot-de-passe?token=tok_reset");
    expect(mail.html).not.toContain("<script");
  });
});
