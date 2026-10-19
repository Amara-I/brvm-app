import { describe, expect, it } from "vitest";
import {
  gmailFromMismatch,
  resolveAdminTestRecipient,
  resolveCliTestRecipient,
  resolveEmailProvider,
  resolveSmtpConfig,
} from "./config";

const GMAIL = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "compte@gmail.com",
  SMTP_PASS: "app-password",
};

describe("resolveSmtpConfig", () => {
  it("lit les variables SMTP_* et active SSL sur le port 465", () => {
    expect(resolveSmtpConfig(GMAIL)).toEqual({
      source: "options",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "compte@gmail.com", pass: "app-password" },
    });
  });

  it("déduit STARTTLS (secure=false) pour le port 587 si SMTP_SECURE est absent", () => {
    const config = resolveSmtpConfig({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
    });
    expect(config).toMatchObject({ port: 587, secure: false });
  });

  it("déduit SSL pour le port 465 si SMTP_SECURE est absent", () => {
    const config = resolveSmtpConfig({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
    });
    expect(config).toMatchObject({ port: 465, secure: true });
  });

  it("respecte SMTP_SECURE=false même sur le port 465", () => {
    const config = resolveSmtpConfig({ ...GMAIL, SMTP_SECURE: "false" });
    expect(config).toMatchObject({ port: 465, secure: false });
  });

  it("refuse un port ou un SMTP_SECURE illisible", () => {
    expect(resolveSmtpConfig({ ...GMAIL, SMTP_PORT: "smtp" })).toBeNull();
    expect(resolveSmtpConfig({ ...GMAIL, SMTP_SECURE: "maybe" })).toBeNull();
  });

  it("refuse une authentification à moitié renseignée", () => {
    expect(resolveSmtpConfig({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "compte@gmail.com" })).toBeNull();
    expect(resolveSmtpConfig({ SMTP_HOST: "smtp.gmail.com", SMTP_PASS: "secret" })).toBeNull();
  });

  it("accepte un relais local sans authentification", () => {
    expect(resolveSmtpConfig({ EMAIL_SERVER_HOST: "127.0.0.1", EMAIL_SERVER_PORT: "1025" })).toEqual({
      source: "options",
      host: "127.0.0.1",
      port: 1025,
      secure: false,
    });
  });

  it("conserve l'URL historique EMAIL_SERVER si SMTP_HOST est absent", () => {
    expect(resolveSmtpConfig({ EMAIL_SERVER: "smtp://user:pass@smtp.exemple.com:587" })).toEqual({
      source: "url",
      url: "smtp://user:pass@smtp.exemple.com:587",
    });
  });

  it("fait primer SMTP_HOST sur EMAIL_SERVER", () => {
    const config = resolveSmtpConfig({
      ...GMAIL,
      EMAIL_SERVER: "smtp://other:pw@smtp.exemple.com:2525",
    });
    expect(config).toMatchObject({ source: "options", host: "smtp.gmail.com" });
  });
});

describe("resolveEmailProvider", () => {
  it("n'a aucun fournisseur sans configuration", () => {
    expect(resolveEmailProvider({})).toBeNull();
  });

  it("choisit SMTP dès que SMTP_* est défini, même si Resend est aussi présent", () => {
    expect(resolveEmailProvider({ ...GMAIL, RESEND_API_KEY: "re_test" })).toBe("smtp");
  });

  it("choisit Resend seulement en l'absence de SMTP", () => {
    expect(resolveEmailProvider({ RESEND_API_KEY: "re_test" })).toBe("resend");
  });

  it("ne retombe pas sur Resend si SMTP_* est incomplet", () => {
    expect(
      resolveEmailProvider({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "compte@gmail.com",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "compte@gmail.com",
      })
    ).toBeNull();
  });

  it("honore EMAIL_PROVIDER et n'a pas de repli silencieux", () => {
    expect(resolveEmailProvider({ ...GMAIL, RESEND_API_KEY: "re_test", EMAIL_PROVIDER: "resend" })).toBe("resend");
    expect(resolveEmailProvider({ ...GMAIL, RESEND_API_KEY: "re_test", EMAIL_PROVIDER: "smtp" })).toBe("smtp");
    expect(resolveEmailProvider({ RESEND_API_KEY: "re_test", EMAIL_PROVIDER: "smtp" })).toBeNull();
    expect(resolveEmailProvider({ ...GMAIL, EMAIL_PROVIDER: "resend" })).toBeNull();
    expect(resolveEmailProvider({ ...GMAIL, EMAIL_PROVIDER: "mailgun" })).toBeNull();
  });
});

describe("gmailFromMismatch", () => {
  it("signale un From différent du compte Gmail", () => {
    const config = resolveSmtpConfig(GMAIL);
    expect(config).not.toBeNull();
    expect(gmailFromMismatch(config!, "autre@domaine.com")).toBe(true);
    expect(gmailFromMismatch(config!, "Compte@gmail.com")).toBe(false);
  });
});

describe("destinataires de test", () => {
  it("n'envoie l'essai admin qu'à l'administrateur connecté", () => {
    expect(resolveAdminTestRecipient("Admin@Yahoo.fr", undefined)).toEqual({ ok: true, to: "admin@yahoo.fr" });
    expect(resolveAdminTestRecipient("admin@yahoo.fr", "admin@yahoo.fr")).toEqual({
      ok: true,
      to: "admin@yahoo.fr",
    });
    expect(resolveAdminTestRecipient("admin@yahoo.fr", "autre@exemple.com")).toEqual({
      ok: false,
      reason: "recipient_not_allowed",
    });
    expect(resolveAdminTestRecipient(null, undefined)).toEqual({ ok: false, reason: "missing_admin_email" });
  });

  it("limite le script aux adresses SMTP_USER et ADMIN_EMAILS", () => {
    const env = { ...GMAIL, ADMIN_EMAILS: "valdestsakem@yahoo.fr" };
    expect(resolveCliTestRecipient(env)).toEqual({ ok: true, to: "compte@gmail.com" });
    expect(resolveCliTestRecipient(env, "valdestsakem@yahoo.fr")).toEqual({
      ok: true,
      to: "valdestsakem@yahoo.fr",
    });
    expect(resolveCliTestRecipient(env, "victime@exemple.com")).toEqual({
      ok: false,
      reason: "recipient_not_allowed",
    });
    expect(resolveCliTestRecipient({})).toEqual({ ok: false, reason: "no_default_recipient" });
  });
});
