export const mail = {
  verifySubject: "Confirmez votre adresse email — {brand}",
  resetSubject: "Réinitialisation de mot de passe — {brand}",
  greeting: "Bonjour,",
  verifyIntro: "Bienvenue sur {brand}. Confirmez votre adresse email ({email}) en ouvrant le lien ci-dessous.",
  resetIntro: "Une demande de réinitialisation de mot de passe a été faite pour le compte {email}.",
  verifyCta: "Confirmer mon email",
  resetCta: "Choisir un nouveau mot de passe",
  expiryOne: "Ce lien expire dans {hours} heure et ne peut être utilisé qu'une seule fois.",
  expiryMany: "Ce lien expire dans {hours} heures et ne peut être utilisé qu'une seule fois.",
  verifyIgnore: "Si vous n'avez pas créé de compte, ignorez simplement cet email.",
  resetIgnore:
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.",
  notConfigured:
    "L'envoi d'emails n'est pas configuré. Sur Vercel, renseignez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et EMAIL_FROM (Gmail : mot de passe d'application), ou EMAIL_PROVIDER=resend avec RESEND_API_KEY.",
  invalidFrom:
    "EMAIL_FROM est invalide. Pour Gmail, utilisez l'adresse du compte (ou un alias « Envoyer en tant que »), par exemple OuestBourse <vous@gmail.com>.",
  sendFailed:
    "L'envoi de l'email a échoué. Vérifiez le mot de passe d'application, SMTP_HOST, SMTP_PORT, SMTP_SECURE et EMAIL_FROM, puis réessayez.",
  invalidReplyTo: "EMAIL_REPLY_TO est invalide. Laissez-le vide ou indiquez une adresse réelle.",
  notificationOpen: "Ouvrir dans {brand}",
  notificationDisclaimer:
    "Ceci n'est pas un conseil d'investissement. Données de marché BRVM, hors horaires calmes si configurés.",
  testSubject: "{brand} — email de test",
  testText:
    "Ceci est un email de test envoyé par {brand}. Si vous le recevez, le transport SMTP est opérationnel.",
  testHtmlLead: "Ceci est un email de test envoyé par",
  testHtmlTail: "Si vous le recevez, le transport SMTP est opérationnel.",
} as const;
