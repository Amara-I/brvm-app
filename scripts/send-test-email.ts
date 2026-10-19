// Envoi d'un email de test via le même transport que l'application.
// Ce n'est pas un relais : sans argument, le destinataire est SMTP_USER
// (sinon le premier email de ADMIN_EMAILS). Un argument n'est accepté
// que s'il est SMTP_USER ou listé dans ADMIN_EMAILS.
//
// Usage (Node 20+) :
//   node --env-file=.env ./node_modules/.bin/ts-node --transpile-only scripts/send-test-email.ts
//   node --env-file=.env ./node_modules/.bin/ts-node --transpile-only scripts/send-test-email.ts vous@gmail.com

import { describeAppMailSetup, MAIL_USER_MESSAGES, sendAppEmail } from "../lib/auth/email";
import { resolveCliTestRecipient } from "../lib/mail/config";
import { BRAND_NAME } from "../lib/theme/brand";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  if (!describeAppMailSetup().configured) {
    fail(MAIL_USER_MESSAGES.not_configured);
  }

  const requested = process.argv[2];
  const recipient = resolveCliTestRecipient(process.env, requested);
  if (!recipient.ok) {
    if (recipient.reason === "recipient_not_allowed") {
      fail("Destinataire refusé. Le script n'envoie qu'à SMTP_USER ou à une adresse de ADMIN_EMAILS.");
    }
    fail("Aucun destinataire par défaut. Renseignez SMTP_USER ou ADMIN_EMAILS.");
  }

  const result = await sendAppEmail({
    to: recipient.to,
    subject: `${BRAND_NAME} — email de test`,
    text: `Ceci est un email de test envoyé par ${BRAND_NAME} (scripts/send-test-email.ts).`,
    html: `<p>Ceci est un email de test envoyé par <strong>${BRAND_NAME}</strong> (scripts/send-test-email.ts).</p>`,
  });

  if (!result.ok) {
    console.error(result.userMessage);
    if (result.error !== result.userMessage) console.error(result.error);
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, provider: result.provider, to: recipient.to }));
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
