import { describe, expect, it } from "vitest";
import { isEmailConfigured, sendNotificationEmail } from "./email";

describe("notification email", () => {
  it("détecte Resend ou SMTP comme l'auth", () => {
    expect(isEmailConfigured({})).toBe(false);
    expect(isEmailConfigured({ RESEND_API_KEY: "re_test" })).toBe(true);
    expect(isEmailConfigured({ EMAIL_SERVER: "smtp://localhost:1025" })).toBe(true);
    expect(isEmailConfigured({ EMAIL_SERVER_HOST: "smtp.exemple.com" })).toBe(true);
  });

  it("n'envoie rien sans fournisseur", async () => {
    const prevResend = process.env.RESEND_API_KEY;
    const prevSmtp = process.env.EMAIL_SERVER;
    const prevHost = process.env.EMAIL_SERVER_HOST;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_SERVER;
    delete process.env.EMAIL_SERVER_HOST;

    const result = await sendNotificationEmail({
      to: "user@example.com",
      title: "SNTS — seuil atteint",
      body: "Cours 32 000 FCFA",
      href: "/actions/SNTS",
    });
    expect(result).toEqual({ sent: false, skipped: "email_not_configured" });

    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
    if (prevSmtp === undefined) delete process.env.EMAIL_SERVER;
    else process.env.EMAIL_SERVER = prevSmtp;
    if (prevHost === undefined) delete process.env.EMAIL_SERVER_HOST;
    else process.env.EMAIL_SERVER_HOST = prevHost;
  });
});
