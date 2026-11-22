import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALERT_THRESHOLD_MB,
  DEFAULT_PLAN_LIMIT_MB,
  bytesToMb,
  buildDbSizeAlertEmail,
  evaluateDbSize,
  measureDatabaseSize,
  parsePositiveMb,
  resolveDbSizeAlertRecipients,
  sanitizeTableName,
  sendDbSizeAlert,
} from "./database-size";

describe("bytesToMb / parsePositiveMb", () => {
  it("convertit les octets en Mo arrondis à 1 décimale", () => {
    expect(bytesToMb(0)).toBe(0);
    expect(bytesToMb(-10)).toBe(0);
    expect(bytesToMb(190_840_832)).toBe(182);
    expect(bytesToMb(350 * 1024 * 1024)).toBe(350);
    expect(bytesToMb(367_001_600n)).toBe(350);
  });

  it("ignore une valeur d'environnement invalide", () => {
    expect(parsePositiveMb(undefined, 350)).toBe(350);
    expect(parsePositiveMb("", 350)).toBe(350);
    expect(parsePositiveMb("0", 350)).toBe(350);
    expect(parsePositiveMb("-20", 350)).toBe(350);
    expect(parsePositiveMb("abc", 350)).toBe(350);
    expect(parsePositiveMb("400", 350)).toBe(400);
  });
});

describe("evaluateDbSize", () => {
  it("reste sous le seuil à 182 Mo / 350 Mo", () => {
    const report = evaluateDbSize({
      bytes: 190_840_832,
      tables: [{ name: "price_history", bytes: 50_331_648, rowCount: 12_345n }],
    });
    expect(report.sizeMb).toBe(182);
    expect(report.thresholdMb).toBe(DEFAULT_ALERT_THRESHOLD_MB);
    expect(report.planLimitMb).toBe(DEFAULT_PLAN_LIMIT_MB);
    expect(report.usagePercent).toBe(36.4);
    expect(report.overThreshold).toBe(false);
    expect(report.tables[0]).toEqual({
      name: "price_history",
      bytes: 50_331_648,
      sizeMb: 48,
      rowCount: 12_345,
    });
  });

  it("dépasse le seuil seulement au-delà de 350 Mo, pas à égalité", () => {
    expect(evaluateDbSize({ bytes: 350 * 1024 * 1024 }).overThreshold).toBe(false);
    expect(evaluateDbSize({ bytes: 350 * 1024 * 1024 + 200_000 }).overThreshold).toBe(true);
  });

  it("accepte un seuil et un plafond configurables", () => {
    const report = evaluateDbSize({
      bytes: 200 * 1024 * 1024,
      thresholdMb: 180,
      planLimitMb: 400,
    });
    expect(report.overThreshold).toBe(true);
    expect(report.thresholdMb).toBe(180);
    expect(report.planLimitMb).toBe(400);
    expect(report.usagePercent).toBe(50);
  });

  it("neutralise un nom de table inattendu", () => {
    expect(sanitizeTableName("chart_series")).toBe("chart_series");
    expect(sanitizeTableName("PriceHistory")).toBe("PriceHistory");
    expect(sanitizeTableName("public.price_history; drop table x")).toBe("table");
  });
});

describe("destinataires d'alerte", () => {
  it("fusionne ADMIN_EMAILS et ALERT_EMAIL_TO sans doublon", () => {
    expect(
      resolveDbSizeAlertRecipients({
        ADMIN_EMAILS: "ValdesTsakem@yahoo.fr, autre@exemple.com",
        ALERT_EMAIL_TO: "valdestsakem@yahoo.fr",
      })
    ).toEqual(["valdestsakem@yahoo.fr", "autre@exemple.com"]);
    expect(resolveDbSizeAlertRecipients({})).toEqual([]);
  });
});

describe("mesure et alerte", () => {
  it("agrège la taille globale et les tables renvoyées par Prisma", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ bytes: 190_840_832n }])
      .mockResolvedValueOnce([{ name: "price_history", bytes: 50_331_648n, row_count: 12_345n }]);

    const report = await measureDatabaseSize({ $queryRaw: queryRaw } as never);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(report.sizeMb).toBe(182);
    expect(report.overThreshold).toBe(false);
    expect(report.tables).toHaveLength(1);
    expect(report.tables[0].name).toBe("price_history");
  });

  it("n'envoie pas d'email sous le seuil", async () => {
    const send = vi.fn();
    const result = await sendDbSizeAlert(evaluateDbSize({ bytes: 190_840_832 }), { send });
    expect(result).toEqual({ needed: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("signale l'absence de destinataire au-dessus du seuil", async () => {
    const send = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await sendDbSizeAlert(evaluateDbSize({ bytes: 400 * 1024 * 1024 }), {
      env: {},
      send,
    });
    expect(result).toEqual({ needed: true, sent: false, recipientCount: 0, skipped: "no_recipient" });
    expect(send).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("envoie un e-mail à chaque destinataire au-dessus du seuil", async () => {
    const send = vi.fn(async () => ({ ok: true as const, provider: "smtp" as const }));
    const report = evaluateDbSize({
      bytes: 400 * 1024 * 1024,
      tables: [{ name: "price_history", bytes: 80 * 1024 * 1024, rowCount: 1_000 }],
    });
    const result = await sendDbSizeAlert(report, {
      env: {
        ADMIN_EMAILS: "admin@exemple.com",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "compte@gmail.com",
        SMTP_PASS: "app-password",
        EMAIL_FROM: "OuestBourse <compte@gmail.com>",
      },
      send,
    });
    expect(result).toEqual({ needed: true, sent: true, recipientCount: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@exemple.com",
        subject: expect.stringContaining("400 Mo"),
        text: expect.stringContaining("price_history"),
        html: expect.stringContaining("price_history"),
      })
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain("app-password");
    expect(JSON.stringify(send.mock.calls)).not.toContain("SMTP_PASS");
  });

  it("compose un e-mail sans secret ni URL de base", () => {
    const mail = buildDbSizeAlertEmail(
      evaluateDbSize({
        bytes: 400 * 1024 * 1024,
        tables: [{ name: "price_history", bytes: 80 * 1024 * 1024, rowCount: 9 }],
      })
    );
    const blob = `${mail.subject}\n${mail.text}\n${mail.html}`;
    expect(blob).toContain("400 Mo");
    expect(blob).toContain("350");
    expect(blob).toContain("500");
    expect(blob).not.toContain("DATABASE_URL");
    expect(blob).not.toContain("CRON_SECRET");
    expect(blob).not.toContain("SMTP_PASS");
  });
});
