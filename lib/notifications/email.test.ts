import { describe, expect, it } from "vitest";
import { isEmailConfigured, sendNotificationEmail } from "./email";

describe("notification email", () => {
  it("exige un fournisseur ET un EMAIL_FROM valide, comme l'auth", () => {
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

  it("n'envoie rien sans fournisseur", async () => {
    const keys = [
      "RESEND_API_KEY",
      "EMAIL_SERVER",
      "EMAIL_SERVER_HOST",
      "EMAIL_SERVER_PORT",
      "EMAIL_SERVER_USER",
      "EMAIL_SERVER_PASSWORD",
      "EMAIL_SERVER_SECURE",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_SECURE",
      "SMTP_USER",
      "SMTP_PASS",
      "EMAIL_PROVIDER",
      "EMAIL_FROM",
      "EMAIL_REPLY_TO",
    ] as const;
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    try {
      const result = await sendNotificationEmail({
        to: "user@example.com",
        title: "SNTS — seuil atteint",
        body: "Cours 32 000 FCFA",
        href: "/actions/SNTS",
      });
      expect(result).toEqual({ sent: false, skipped: "email_not_configured" });
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
