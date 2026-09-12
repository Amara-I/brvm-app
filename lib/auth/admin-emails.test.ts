import { describe, expect, it } from "vitest";
import { isAdminEmail, isAdminRoleOrEmail, parseAdminEmails } from "./admin-emails";

describe("parseAdminEmails", () => {
  it("normalise une liste séparée par des virgules", () => {
    expect(parseAdminEmails(" Owner@OuestBourse.test , other@x.com ")).toEqual([
      "owner@ouestbourse.test",
      "other@x.com",
    ]);
    expect(parseAdminEmails("not-an-email,ok@ok.com")).toEqual(["ok@ok.com"]);
  });
});

describe("isAdminEmail / isAdminRoleOrEmail", () => {
  it("reconnaît un email allowlisté sans tenir compte de la casse", () => {
    expect(isAdminEmail("Owner@OuestBourse.test", "owner@ouestbourse.test")).toBe(true);
    expect(isAdminEmail("nope@x.com", "owner@ouestbourse.test")).toBe(false);
    expect(isAdminEmail(null, "owner@ouestbourse.test")).toBe(false);
  });

  it("accorde l'admin via le rôle Prisma ou l'allowlist", () => {
    expect(isAdminRoleOrEmail({ role: "ADMIN", email: "user@x.com" })).toBe(true);
    expect(isAdminRoleOrEmail({ role: "USER", email: "owner@x.com" }, "owner@x.com")).toBe(true);
    expect(isAdminRoleOrEmail({ role: "USER", email: "nope@x.com" }, "owner@x.com")).toBe(false);
    expect(isAdminRoleOrEmail(null, "owner@x.com")).toBe(false);
  });
});
