import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthEmail,
  describeAppMailSetup,
  getEmailFrom,
  hasEmailProvider,
  isDevAuthPreviewEnabled,
  isEmailConfigured,
  parseEmailFrom,
  sendAppEmail,
  sendAuthEmail,
} from "./email";

const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: "mid-1" })));
const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail })));

vi.mock("nodemailer", () => ({
  createTransport,
  default: { createTransport },
}));

const MAIL_KEYS = [
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_SERVER",
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_SERVER_SECURE",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
] as const;

function snapshotMailEnv(): Record<string, string | undefined> {
  return Object.fromEntries(MAIL_KEYS.map((key) => [key, process.env[key]]));
}

function applyMailEnv(values: Record<string, string | undefined>) {
  for (const key of MAIL_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

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
    expect(
      isEmailConfigured({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "compte@gmail.com",
        SMTP_PASS: "app-password",
        EMAIL_FROM: "OuestBourse <compte@gmail.com>",
      })
    ).toBe(true);
    expect(
      isEmailConfigured({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "compte@gmail.com",
        EMAIL_FROM: "OuestBourse <compte@gmail.com>",
      })
    ).toBe(false);
    expect(
      describeAppMailSetup({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "compte@gmail.com",
        SMTP_PASS: "app-password",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "compte@gmail.com",
      }).provider
    ).toBe("smtp");
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

  it("rédige un email de confirmation en anglais", () => {
    const mail = buildAuthEmail("verify", "user@example.com", "tok_verify", "en");
    expect(mail.subject).toContain("Confirm your email");
    expect(mail.html).toContain("Confirm my email");
    expect(mail.html).toContain('lang="en"');
  });

  it("rédige un email de reset en français", () => {
    const mail = buildAuthEmail("reset", "user@example.com", "tok_reset");
    expect(mail.subject).toContain("Réinitialisation");
    expect(mail.text).toContain("/reinitialiser-mot-de-passe?token=tok_reset");
    expect(mail.html).not.toContain("<script");
  });
});

describe("envoi — échec bruyant et choix du transport", () => {
  const previous = snapshotMailEnv();

  afterEach(() => {
    applyMailEnv({});
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "mid-1" });
    createTransport.mockClear();
    vi.unstubAllGlobals();
  });

  it("refuse l'envoi sans configuration au lieu d'un succès fictif", async () => {
    applyMailEnv({});
    const app = await sendAppEmail({
      to: "user@ouestbourse.com",
      subject: "Test",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
    });
    const auth = await sendAuthEmail("verify", "user@ouestbourse.com", "tok");
    expect(app.ok).toBe(false);
    expect(auth.ok).toBe(false);
    if (!app.ok && !auth.ok) {
      expect(app.code).toBe("not_configured");
      expect(auth.code).toBe("not_configured");
      expect(app.userMessage).toMatch(/n'est pas configuré/);
    }
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("refuse un EMAIL_FROM invalide même si SMTP est prêt", async () => {
    applyMailEnv({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
      EMAIL_FROM: "pas-une-adresse",
    });
    const result = await sendAppEmail({
      to: "user@ouestbourse.com",
      subject: "Test",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_from");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("envoie via SMTP (Gmail) et ignore Resend quand les deux sont définis", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    applyMailEnv({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "OuestBourse <compte@gmail.com>",
      EMAIL_REPLY_TO: "reponse@yahoo.fr",
    });

    const result = await sendAppEmail({
      to: "user@ouestbourse.com",
      subject: "Test",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
    });

    expect(result).toEqual({ ok: true, provider: "smtp" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "compte@gmail.com", pass: "app-password" },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "OuestBourse <compte@gmail.com>",
        to: "user@ouestbourse.com",
        replyTo: "reponse@yahoo.fr",
      })
    );
  });

  it("n'utilise pas Resend quand EMAIL_PROVIDER=smtp est incomplet", async () => {
    applyMailEnv({
      EMAIL_PROVIDER: "smtp",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "compte@gmail.com",
    });
    const result = await sendAuthEmail("reset", "user@ouestbourse.com", "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_configured");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("échoue bruyamment si le transport SMTP lève une erreur", async () => {
    sendMail.mockRejectedValueOnce(new Error("Invalid login: app-password"));
    applyMailEnv({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
      EMAIL_FROM: "compte@gmail.com",
    });
    const result = await sendAppEmail({
      to: "user@ouestbourse.com",
      subject: "Test",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("send_failed");
      expect(result.error).toContain("Invalid login");
      expect(result.error).not.toContain("app-password");
    }
  });

  it("envoie via Resend uniquement si EMAIL_PROVIDER=resend", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    applyMailEnv({
      EMAIL_PROVIDER: "resend",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "compte@gmail.com",
      SMTP_PASS: "app-password",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "OuestBourse <compte@gmail.com>",
    });

    const result = await sendAppEmail({
      to: "user@ouestbourse.com",
      subject: "Test",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
    });

    expect(result).toEqual({ ok: true, provider: "resend" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test" });
  });
});
