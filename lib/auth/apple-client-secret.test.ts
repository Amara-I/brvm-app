import { createPrivateKey, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAppleClientSecret, normalizeApplePrivateKey } from "./apple-client-secret";

function decode(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("createAppleClientSecret", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("signe un JWT ES256 dont Apple peut vérifier la forme", () => {
    const now = 1_700_000_000;
    const token = createAppleClientSecret({
      clientId: "app.ouestbourse.web",
      teamId: "TEAMID1234",
      keyId: "KEYID12345",
      privateKey: pem.replace(/\n/g, "\\n"),
      now,
    });
    expect(token).toBeTruthy();
    const [header, payload, signature] = token!.split(".");
    expect(decode(header)).toEqual({ alg: "ES256", kid: "KEYID12345" });
    expect(decode(payload)).toMatchObject({
      iss: "TEAMID1234",
      iat: now,
      exp: now + 150 * 24 * 60 * 60,
      aud: "https://appleid.apple.com",
      sub: "app.ouestbourse.web",
    });
    const publicKey = createPublicKey(privateKey);
    const ok = verify(
      "SHA256",
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url")
    );
    expect(ok).toBe(true);
  });

  it("ignore une clé qui n'est pas une EC P-256", () => {
    expect(createAppleClientSecret({
      clientId: "app.ouestbourse.web",
      teamId: "TEAM",
      keyId: "KEY",
      privateKey: "pas une clé",
    })).toBeNull();
    expect(normalizeApplePrivateKey('"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----"')).toContain(
      "\n"
    );
    expect(createPrivateKey(pem).asymmetricKeyType).toBe("ec");
  });
});
