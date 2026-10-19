# Courrier transactionnel — SMTP (Gmail)

Tous les envois (confirmation d'inscription, renvoi de vérification, mot de
passe oublié, alertes, notifications, digests) passent par `sendAppEmail` /
`sendAuthEmail` (`lib/auth/email.ts`). Il n'y a pas de fournisseur Email
NextAuth : les liens sont des jetons applicatifs.

Le fournisseur se choisit avec `EMAIL_PROVIDER` :

| Valeur | Comportement |
|---|---|
| `smtp` | SMTP uniquement. Config incomplète → échec, pas de repli Resend. |
| `resend` | Resend uniquement. Sans `RESEND_API_KEY` → échec, pas de repli SMTP. |
| absent | **SMTP si `SMTP_HOST` (ou l'alias historique) est utilisable**, sinon Resend si `RESEND_API_KEY` est défini. Une config SMTP **incomplète** (hôte sans mot de passe, par exemple) ne retombe pas sur Resend. |

Sans fournisseur **et** sans `EMAIL_FROM` valide, l'envoi échoue. Les routes
d'auth répondent 503/502 avec un message français. Rien n'est journalisé
comme un succès.

Limite Gmail : environ **500 messages par jour** pour un compte personnel.
Au-delà, Gmail refuse l'envoi (`send_failed`, pas un succès silencieux).

## Gmail — mot de passe d'application

Gmail refuse le mot de passe habituel du compte dès que la validation en
deux étapes est active. Il faut un mot de passe d'application (16 caractères).

1. Ouvrir le compte Gmail qui servira d'expéditeur.
2. Activer la validation en deux étapes :
   https://myaccount.google.com/signinoptions/two-step-verification
3. Créer un mot de passe d'application (le menu n'apparaît qu'une fois la
   validation en deux étapes active) :
   https://myaccount.google.com/apppasswords
   Nom suggéré : `OuestBourse`.
4. Copier les 16 caractères. Les espaces affichés par Google sont facultatifs.
5. L'expéditeur (`EMAIL_FROM`) doit être **cette adresse Gmail**, ou un alias
   déjà autorisé dans Gmail (« Envoyer des e-mails en tant que »). Toute autre
   adresse est réécrite par Gmail. `EMAIL_REPLY_TO` peut être une autre
   adresse (par exemple l'admin `valdestsakem@yahoo.fr`).

Les comptes Google Workspace peuvent interdire les mots de passe
d'application : dans ce cas l'administrateur du domaine doit les autoriser,
ou il faut un autre relais SMTP (les mêmes variables, autre hôte).

## Variables

Port **465** (SSL, recommandé) :

```bash
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="compte@gmail.com"
SMTP_PASS="xxxxxxxxxxxxxxxx"
EMAIL_FROM="OuestBourse <compte@gmail.com>"
# facultatif
EMAIL_REPLY_TO="valdestsakem@yahoo.fr"
```

Port **587** (STARTTLS) : `SMTP_PORT="587"` et `SMTP_SECURE="false"`.
Si `SMTP_SECURE` est omis, le port 465 active SSL et tout autre port
laisse STARTTLS (`secure=false`).

`SMTP_USER` sans `SMTP_PASS` (ou l'inverse) est une config incomplète :
l'envoi est refusé.

Alias encore lus, si `SMTP_HOST` est absent : `EMAIL_SERVER` (URL
`smtp://…`) ou `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` /
`EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` / `EMAIL_SERVER_SECURE`.
Dès que `SMTP_HOST` est défini, ce sont les variables `SMTP_*` qui
s'appliquent.

## Vercel

Projet `brwm-app` (production https://brwm-app.vercel.app) → **Settings →
Environment Variables**. Renseigner les variables ci-dessus pour
**Production** (et Preview si les aperçus doivent envoyer du courrier).
`SMTP_PASS` est un secret : ne pas le committer, ne pas le coller dans un
log.

Les variables ne sont prises en compte qu'au **prochain déploiement**.
Retirer `RESEND_API_KEY` n'est pas obligatoire : si `SMTP_*` est complet et
que `EMAIL_PROVIDER` n'est pas `resend`, SMTP est utilisé.

`ADMIN_EMAILS` doit contenir `valdestsakem@yahoo.fr` (ou le rôle Prisma du
compte doit être `ADMIN`) pour l'essai HTTP.

Les routes qui envoient du courrier sont en runtime **Node** (`nodejs`),
pas Edge : nodemailer a besoin de `net` / `tls`.

## Essai sans relais ouvert

Route admin (session du compte admin) :

```bash
# état, sans envoi
curl -s -b cookies.txt https://brwm-app.vercel.app/api/admin/email/test

# envoi à l'adresse de la session uniquement
curl -s -b cookies.txt -X POST https://brwm-app.vercel.app/api/admin/email/test
```

Un `{"to":"autre@exemple.com"}` répond **403**. Sans configuration : **503**.
Échec SMTP : **502**. Un essai par minute et par admin.

Script local (même garde : `SMTP_USER` ou `ADMIN_EMAILS` seulement) :

```bash
node --env-file=.env ./node_modules/.bin/ts-node --transpile-only scripts/send-test-email.ts
```

## Resend (repli optionnel)

Conservé pour pouvoir revenir en arrière sans changer le code :

```bash
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="OuestBourse <noreply@domaine-verifie.com>"
```

Le domaine doit être vérifié chez Resend. `onboarding@resend.dev` ne
convient pas en production.
