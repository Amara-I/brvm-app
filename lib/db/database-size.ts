// Mesure de la taille Postgres (plan Free Supabase : 500 Mo) pour
// GET /api/cron/db-size. Requêtes de catalogue uniquement — pas de scan
// de tables métier, aucun secret dans le rapport.

import type { PrismaClient } from "@prisma/client";
import { parseAdminEmails } from "@/lib/auth/admin-emails";
import { isEmailConfigured, sendAppEmail, type SendEmailResult } from "@/lib/auth/email";
import { prisma } from "@/lib/prisma";
import { BRAND_NAME } from "@/lib/theme/brand";

export const DEFAULT_ALERT_THRESHOLD_MB = 350;
export const DEFAULT_PLAN_LIMIT_MB = 500;
export const DEFAULT_TOP_TABLES = 10;

export type EnvMap = Record<string, string | undefined>;

export type TableSize = {
  name: string;
  bytes: number;
  sizeMb: number;
  /** Estimation `n_live_tup` (pg_stat), pas un COUNT exact. */
  rowCount: number;
};

export type DbSizeReport = {
  bytes: number;
  sizeMb: number;
  thresholdMb: number;
  planLimitMb: number;
  usagePercent: number;
  overThreshold: boolean;
  tables: TableSize[];
};

export type DbSizeAlertResult =
  | { needed: false }
  | { needed: true; sent: boolean; recipientCount: number; skipped?: string };

type Db = Pick<PrismaClient, "$queryRaw">;

const SAFE_TABLE_NAME = /^[A-Za-z0-9_]+$/;

function toNumber(value: number | bigint | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return value;
}

export function bytesToMb(bytes: number | bigint | string): number {
  const n = toNumber(bytes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / (1024 * 1024)) * 10) / 10;
}

export function parsePositiveMb(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function readDbSizeThresholds(env: EnvMap = process.env): {
  thresholdMb: number;
  planLimitMb: number;
} {
  return {
    thresholdMb: parsePositiveMb(env.DB_SIZE_ALERT_MB, DEFAULT_ALERT_THRESHOLD_MB),
    planLimitMb: parsePositiveMb(env.DB_SIZE_PLAN_LIMIT_MB, DEFAULT_PLAN_LIMIT_MB),
  };
}

export function sanitizeTableName(name: string): string {
  return SAFE_TABLE_NAME.test(name) ? name : "table";
}

export function evaluateDbSize(input: {
  bytes: number | bigint | string;
  tables?: Array<{ name: string; bytes: number | bigint | string; rowCount?: number | bigint | string }>;
  thresholdMb?: number;
  planLimitMb?: number;
}): DbSizeReport {
  const bytes = Math.max(0, Math.round(toNumber(input.bytes)) || 0);
  const thresholdMb =
    input.thresholdMb != null && input.thresholdMb > 0 ? input.thresholdMb : DEFAULT_ALERT_THRESHOLD_MB;
  const planLimitMb =
    input.planLimitMb != null && input.planLimitMb > 0 ? input.planLimitMb : DEFAULT_PLAN_LIMIT_MB;
  const sizeMb = bytesToMb(bytes);
  const usagePercent = planLimitMb > 0 ? Math.round((sizeMb / planLimitMb) * 1000) / 10 : 0;
  return {
    bytes,
    sizeMb,
    thresholdMb,
    planLimitMb,
    usagePercent,
    overThreshold: sizeMb > thresholdMb,
    tables: (input.tables ?? []).map((table) => ({
      name: sanitizeTableName(table.name),
      bytes: Math.max(0, Math.round(toNumber(table.bytes)) || 0),
      sizeMb: bytesToMb(table.bytes),
      rowCount: Math.max(0, Math.round(toNumber(table.rowCount)) || 0),
    })),
  };
}

export function resolveDbSizeAlertRecipients(env: EnvMap = process.env): string[] {
  return [...new Set([...parseAdminEmails(env.ADMIN_EMAILS), ...parseAdminEmails(env.ALERT_EMAIL_TO)])];
}

export function buildDbSizeAlertEmail(report: DbSizeReport): { subject: string; text: string; html: string } {
  const subject = `${BRAND_NAME} — Alerte : base à ${report.sizeMb} Mo / ${report.planLimitMb} Mo`;
  const lines = [
    `La base Postgres atteint ${report.sizeMb} Mo, au-dessus du seuil d'alerte de ${report.thresholdMb} Mo.`,
    `Plafond du plan Free Supabase : ${report.planLimitMb} Mo (${report.usagePercent} % utilisés).`,
    "",
    "Tables les plus volumineuses (taille totale index compris, lignes estimées) :",
    ...report.tables.map((table) => `- ${table.name} : ${table.sizeMb} Mo, ~${table.rowCount} lignes`),
  ];
  const text = lines.join("\n");
  const rows = report.tables
    .map(
      (table) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(table.name)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${table.sizeMb} Mo</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">~${table.rowCount}</td></tr>`
    )
    .join("");
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <p style="color:#C9A227;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:12px">${escapeHtml(BRAND_NAME)}</p>
      <h1 style="font-size:20px;margin:8px 0 12px">Taille de la base : ${report.sizeMb} Mo</h1>
      <p style="font-size:15px;line-height:1.5">
        La base Postgres atteint <strong>${report.sizeMb} Mo</strong>, au-dessus du seuil d'alerte
        de ${report.thresholdMb} Mo. Plafond du plan Free Supabase :
        ${report.planLimitMb} Mo (${report.usagePercent} % utilisés).
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:12px">
        <thead>
          <tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc">Table</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc">Taille</th>
            <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc">Lignes (estim.)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  return { subject, text, html };
}

export async function measureDatabaseSize(
  db: Db = prisma,
  thresholds: { thresholdMb?: number; planLimitMb?: number } = readDbSizeThresholds()
): Promise<DbSizeReport> {
  const client = db ?? prisma;
  const sizeRows = await client.$queryRaw<Array<{ bytes: bigint | number }>>`
    SELECT pg_database_size(current_database()) AS bytes
  `;
  const tableRows = await client.$queryRaw<Array<{ name: string; bytes: bigint | number; row_count: bigint | number }>>`
    SELECT
      c.relname AS name,
      pg_total_relation_size(c.oid) AS bytes,
      COALESCE(s.n_live_tup, 0)::bigint AS row_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 10
  `;

  return evaluateDbSize({
    bytes: sizeRows[0]?.bytes ?? 0,
    tables: tableRows.map((row) => ({ name: row.name, bytes: row.bytes, rowCount: row.row_count })),
    thresholdMb: thresholds.thresholdMb,
    planLimitMb: thresholds.planLimitMb,
  });
}

export async function sendDbSizeAlert(
  report: DbSizeReport,
  options: {
    env?: EnvMap;
    send?: (input: { to: string; subject: string; html: string; text: string }) => Promise<SendEmailResult>;
  } = {}
): Promise<DbSizeAlertResult> {
  if (!report.overThreshold) return { needed: false };

  const env = options.env ?? process.env;
  const recipients = resolveDbSizeAlertRecipients(env);
  if (recipients.length === 0) {
    console.warn("[db-size] seuil dépassé, aucun destinataire (ADMIN_EMAILS ou ALERT_EMAIL_TO)");
    return { needed: true, sent: false, recipientCount: 0, skipped: "no_recipient" };
  }
  if (!isEmailConfigured(env)) {
    console.warn("[db-size] seuil dépassé, envoi d'email non configuré");
    return { needed: true, sent: false, recipientCount: recipients.length, skipped: "email_not_configured" };
  }

  const mail = buildDbSizeAlertEmail(report);
  const send = options.send ?? sendAppEmail;
  let sentCount = 0;
  for (const to of recipients) {
    const result = await send({ to, ...mail });
    if (result.ok) sentCount += 1;
    else console.error("[db-size] échec d'envoi de l'alerte", { code: result.code });
  }

  if (sentCount === 0) {
    return { needed: true, sent: false, recipientCount: recipients.length, skipped: "send_failed" };
  }
  return { needed: true, sent: true, recipientCount: sentCount };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
