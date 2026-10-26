export const mail = {
  verifySubject: "Confirm your email address — {brand}",
  resetSubject: "Password reset — {brand}",
  greeting: "Hello,",
  verifyIntro: "Welcome to {brand}. Confirm your email address ({email}) by opening the link below.",
  resetIntro: "A password reset was requested for the account {email}.",
  verifyCta: "Confirm my email",
  resetCta: "Choose a new password",
  expiryOne: "This link expires in {hours} hour and can only be used once.",
  expiryMany: "This link expires in {hours} hours and can only be used once.",
  verifyIgnore: "If you did not create an account, you can ignore this email.",
  resetIgnore: "If you did not request this, ignore this email — your password will stay the same.",
  notConfigured:
    "Email delivery is not configured. On Vercel, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM (Gmail: an app password), or EMAIL_PROVIDER=resend with RESEND_API_KEY.",
  invalidFrom:
    "EMAIL_FROM is invalid. For Gmail, use the account address (or a “Send mail as” alias), for example OuestBourse <you@gmail.com>.",
  sendFailed:
    "The email could not be sent. Check the app password, SMTP_HOST, SMTP_PORT, SMTP_SECURE and EMAIL_FROM, then try again.",
  invalidReplyTo: "EMAIL_REPLY_TO is invalid. Leave it empty or enter a real address.",
  notificationOpen: "Open in {brand}",
  notificationDisclaimer:
    "This is not investment advice. BRVM market data; quiet hours apply when configured.",
  testSubject: "{brand} — test email",
  testText: "This is a test email sent by {brand}. If you receive it, SMTP delivery is working.",
  testHtmlLead: "This is a test email sent by",
  testHtmlTail: "If you receive it, SMTP delivery is working.",
} as const;
