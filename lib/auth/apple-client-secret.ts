// Secret client Apple : JWT ES256 signé avec la clé .p8 du compte développeur.
// Apple n'accepte pas un secret statique longue durée (maximum ~6 mois).
// On le régénère au démarrage de l'instance serverless, sans fichier sur disque.

import { createPrivateKey, createSign, type KeyObject } from "node:crypto";

const APPLE_AUD = "https://appleid.apple.com";
/** Sous le maximum documenté par Apple (15777000 s ≈ 6 mois). */
const APPLE_SECRET_TTL_SECONDS = 150 * 24 * 60 * 60;

export type AppleClientSecretInput = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  now?: number;
};

export function normalizeApplePrivateKey(value: string): string {
  let pem = value.trim();
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1);
  }
  return pem.replace(/\\n/g, "\n");
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function signingKey(privateKey: string): KeyObject | null {
  try {
    const key = createPrivateKey(normalizeApplePrivateKey(privateKey));
    if (key.asymmetricKeyType !== "ec") return null;
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (curve && curve !== "prime256v1") return null;
    return key;
  } catch {
    return null;
  }
}

/** JWT client_secret, ou null si la clé est illisible (le fournisseur est alors ignoré). */
export function createAppleClientSecret(input: AppleClientSecretInput): string | null {
  const key = signingKey(input.privateKey);
  if (!key) return null;
  if (!input.clientId.trim() || !input.teamId.trim() || !input.keyId.trim()) return null;

  const iat = input.now ?? Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: input.keyId.trim() }));
  const payload = base64url(
    JSON.stringify({
      iss: input.teamId.trim(),
      iat,
      exp: iat + APPLE_SECRET_TTL_SECONDS,
      aud: APPLE_AUD,
      sub: input.clientId.trim(),
    })
  );
  const data = `${header}.${payload}`;
  try {
    const signature = createSign("SHA256").update(data).sign({ key, dsaEncoding: "ieee-p1363" });
    return `${data}.${base64url(signature)}`;
  } catch {
    return null;
  }
}
