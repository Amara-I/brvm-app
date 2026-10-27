import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideMigrate,
  formatMigrateOutcome,
  resolveMigrateTimeoutMs,
  runBounded,
} from "./migrate-on-build.cjs";

const SECRET = "super-secret-value";
const POOLER =
  `postgresql://postgres.proj:${SECRET}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
const SESSION =
  `postgresql://postgres.proj:${SECRET}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
const LOCAL = `postgresql://brvm:${SECRET}@127.0.0.1:5432/brvm_app`;

function assertNoSecret(value: string) {
  expect(value).not.toContain(SECRET);
}

describe("decideMigrate", () => {
  it("ignore le build sans DATABASE_URL", () => {
    const decision = decideMigrate({ databaseUrl: "", directUrl: SESSION, onVercel: true, forced: false });
    expect(decision.action).toBe("skip");
    expect(decision.code).toBe("database-url-absent");
  });

  it("reste un no-op hors Vercel", () => {
    const decision = decideMigrate({
      databaseUrl: LOCAL,
      directUrl: SESSION,
      onVercel: false,
      forced: false,
    });
    expect(decision.code).toBe("not-vercel");
  });

  it("saute les migrations Vercel tant que DIRECT_URL manque sur le pooler 6543", () => {
    const decision = decideMigrate({
      databaseUrl: POOLER,
      directUrl: "  ",
      onVercel: true,
      forced: false,
    });
    expect(decision.action).toBe("skip");
    expect(decision.code).toBe("direct-url-absent");
    expect(decision.message).toContain("DIRECT_URL");
    expect(decision.message).toContain("5432");
    expect(decision.message).toContain("Session pooler");
    expect(decision.message).toContain("Le build continue");
    assertNoSecret(decision.message);
  });

  it("traite pgbouncer=true comme un pooler transaction même sur le port 5432", () => {
    const decision = decideMigrate({
      databaseUrl: `${LOCAL}?pgbouncer=true`,
      directUrl: "",
      onVercel: true,
      forced: false,
    });
    expect(decision.code).toBe("direct-url-absent");
  });

  it("migre via DIRECT_URL session et laisse DATABASE_URL au runtime", () => {
    const decision = decideMigrate({
      databaseUrl: POOLER,
      directUrl: SESSION,
      onVercel: true,
      forced: false,
    });
    expect(decision.action).toBe("migrate");
    if (decision.action !== "migrate") return;
    expect(decision.via).toBe("DIRECT_URL");
    expect(decision.url).toBe(SESSION);
    expect(decision.url).not.toBe(POOLER);
    expect(decision.port).toBe("5432");
    expect(decision.message).toContain("DATABASE_URL");
    assertNoSecret(decision.message);
  });

  it("refuse un DIRECT_URL qui est encore le pooler transaction", () => {
    const decision = decideMigrate({
      databaseUrl: POOLER,
      directUrl: POOLER,
      onVercel: true,
      forced: false,
    });
    expect(decision.code).toBe("direct-url-transaction-pooler");
    expect(decision.message).toContain("5432");
    assertNoSecret(decision.message);
  });

  it("migre une base directe locale quand DIRECT_URL est absente", () => {
    const decision = decideMigrate({
      databaseUrl: LOCAL,
      directUrl: "",
      onVercel: false,
      forced: true,
    });
    expect(decision.action).toBe("migrate");
    if (decision.action !== "migrate") return;
    expect(decision.via).toBe("DATABASE_URL");
    expect(decision.url).toBe(LOCAL);
  });

  it("accepte un mot de passe avec # sur le port session et refuse le port 6543", () => {
    const session = decideMigrate({
      databaseUrl: POOLER,
      directUrl: `postgresql://postgres.proj:pass#word@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      onVercel: true,
      forced: false,
    });
    expect(session.action).toBe("migrate");
    if (session.action !== "migrate") return;
    expect(session.port).toBe("5432");
    expect(session.via).toBe("DIRECT_URL");

    const pooler = decideMigrate({
      databaseUrl: LOCAL,
      directUrl: `postgresql://postgres.proj:pass#word@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      onVercel: true,
      forced: false,
    });
    expect(pooler.code).toBe("direct-url-transaction-pooler");
  });

  it("ne lance pas une URL illisible", () => {
    const decision = decideMigrate({
      databaseUrl: "not a url",
      directUrl: "",
      onVercel: true,
      forced: false,
    });
    expect(decision.code).toBe("database-url-unparseable");
    assertNoSecret(decision.message);
  });
});

describe("resolveMigrateTimeoutMs", () => {
  it("borne par défaut à 120s et ignore une valeur nulle", () => {
    expect(resolveMigrateTimeoutMs(undefined)).toBe(120_000);
    expect(resolveMigrateTimeoutMs("")).toBe(120_000);
    expect(resolveMigrateTimeoutMs("0")).toBe(120_000);
    expect(resolveMigrateTimeoutMs("nope")).toBe(120_000);
    expect(resolveMigrateTimeoutMs("45000")).toBe(45_000);
  });
});

describe("formatMigrateOutcome", () => {
  it("distingue succès, échec et timeout sans fuite d'URL", () => {
    expect(formatMigrateOutcome({ timedOut: false, status: 0, signal: null, error: null }, 120_000).ok).toBe(true);
    const failed = formatMigrateOutcome({ timedOut: false, status: 1, signal: null, error: null }, 120_000);
    expect(failed.ok).toBe(false);
    expect(failed.message).toContain("code 1");
    expect(failed.message.toLowerCase()).toContain("build continue");
    const timedOut = formatMigrateOutcome({ timedOut: true, status: null, signal: "SIGKILL", error: null }, 120_000);
    expect(timedOut.message).toContain("TIMEOUT");
    expect(timedOut.message).toContain("120s");
    assertNoSecret(timedOut.message);
  });
});

describe("runBounded", () => {
  it("tue le groupe de process quand le délai est dépassé", async () => {
    const started = Date.now();
    const result = await runBounded(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      { timeoutMs: 400, graceMs: 2_000, stdio: "ignore" }
    );
    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("laisse finir une commande courte", async () => {
    const result = await runBounded(process.execPath, ["-e", "process.exit(0)"], {
      timeoutMs: 5_000,
      stdio: "ignore",
    });
    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(0);
  });
});

describe("try-migrate-deploy.cjs", () => {
  const script = path.join(__dirname, "try-migrate-deploy.cjs");

  function run(env: Record<string, string | undefined>) {
    const cleaned: NodeJS.ProcessEnv = { ...process.env };
    delete cleaned.DATABASE_URL;
    delete cleaned.DIRECT_URL;
    delete cleaned.VERCEL;
    delete cleaned.PRISMA_MIGRATE_ON_BUILD;
    delete cleaned.PRISMA_MIGRATE_TIMEOUT_MS;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete cleaned[key];
      else cleaned[key] = value;
    }
    return spawnSync(process.execPath, [script], {
      env: cleaned,
      encoding: "utf8",
      timeout: 40_000,
    });
  }

  it("sort tout de suite sur le pooler transaction sans DIRECT_URL", () => {
    const started = Date.now();
    const result = run({ VERCEL: "1", DATABASE_URL: POOLER });
    expect(result.status).toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("DIRECT_URL absent");
    expect(output).toContain("5432");
    expect(output).toContain("Le build continue");
    assertNoSecret(output);
  });

  it("échoue sans bloquer le build si la session est injoignable", () => {
    const result = run({
      VERCEL: "1",
      DATABASE_URL: POOLER,
      DIRECT_URL: `postgresql://postgres.proj:${SECRET}@127.0.0.1:1/postgres`,
      PRISMA_MIGRATE_TIMEOUT_MS: "15000",
    });
    expect(result.status).toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("via DIRECT_URL");
    expect(output).toContain("127.0.0.1:1");
    expect(output).toContain("ÉCHEC");
    expect(output.toLowerCase()).toContain("build continue");
    expect(output).not.toContain("pooler.supabase.com:6543");
    assertNoSecret(output);
  });
});
