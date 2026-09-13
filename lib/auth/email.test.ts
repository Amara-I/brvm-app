import { describe, expect, it } from "vitest";
import {
  buildAuthEmail,
  getEmailFrom,
  hasEmailProvider,
  isDevAuthPreviewEnabled,
  isEmailConfigured,
  parseEmailFrom,
} from "./email";

describe("email config", () => {
  it("exige un fournisseur ET un EMAIL_FROM valide", () => {
    expect(hasEmailProvider({})).toBe(false);
    expect(isEmailConfigured({})).toBe(false);
    expect(isEmailConfigured({ RESEND_API_KEY: "re_test" })).toBe(false);
    expect(
      isEmailConfigured({
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "OuestBourse <noreply@ouestbourse.com>",
      })
    ).toBe(true);
    expect(isEmailConfigured({ EMAIL_SERVER: "smtp://localhost:1025" })).toBe(false);
    expect(
      isEmailConfigured({
        EMAIL_SERVER_HOST: "smtp.exemple.com",
        EMAIL_FROM: "noreply@ouestbourse.com",
      })
    ).toBe(true);
  });

  it("parse et refuse les expéditeurs invalides", () => {
    expect(parseEmailFrom("OuestBourse <pas-une-adresse>")).toBeNull();
    expect(parseEmailFrom("OuestBourse <noreply@localhost>")).toBeNull();
    expect(parseEmailFrom("noreply@example.com")).toBeNull();
    expect(parseEmailFrom("OuestBourse <noreply@ouestbourse.com>")?.address).toBe(
      "noreply@ouestbourse.com"
    );
    expect(getEmailFrom({ EMAIL_FROM: "OuestBourse <noreply@ouestbourse.com>" })).toBe(
      "OuestBourse <noreply@ouestbourse.com>"
    );
    expect(getEmailFrom({})).toBeNull();
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
