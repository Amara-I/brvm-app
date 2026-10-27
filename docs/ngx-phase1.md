# NGX — phase 1 (consultation)

La Nigerian Exchange est consultable sur `/marches/ngx` (liste, fiche, indices). Le portefeuille, le screener et les pages BRVM restent limités à `exchange = BRVM`. Les prix sont en naira (₦). Le montant FCFA est **indicatif** : XOF = 655,957 pour 1 EUR, EUR→NGN via [open.er-api.com](https://www.open.er-api.com) (attribution affichée). Ce n'est pas un fixing officiel.

## Après merge — pas de nouvelle migration

Ce lot n'ajoute aucun fichier dans `prisma/migrations/`. Le schéma NGX (`20261027190000_ngx_exchange_scope` : `exchange`, `currency`, `NGX_OFFICIEL`, `fx_rates`) est déjà sur `main` (PR #62) et déjà appliqué sur Supabase, enregistré dans `_prisma_migrations`. Ne pas le rejouer.

Le build Vercel utilise le migrate borné de la PR #63 (`scripts/try-migrate-deploy.cjs`, `DIRECT_URL`, timeout 120 s, pooler 6543 ignoré). Sans migration nouvelle, `migrate deploy` n'a rien à appliquer.

## Ingestion du jour

Le cron unique `0 17 * * *` UTC (après la clôture de Lagos, 14:30) appelle `runNgxDailyIngest` après la persistance BRVM, hors du lot Sikafinance/Richbourse. Plafond 25 s, étape sautée s'il reste moins de 12 s. Désactivation : `INGESTION_ENABLE_NGX=false`.

Source : JSON `doclib.ngxgroup.com/.../statistics/equities` (contrôle : 80–250 symboles, clôtures > 0, date de séance ≤ 10 jours). Sinon repli PDF « Daily Official List », puis « DAILY SUMMARY » apparié par raison sociale, avec alerte.

Les séries `chart_series` NGX sont rafraîchies dans le temps restant de cette étape.

## Historique 5 ans

À lancer sur une machine qui a `DATABASE_URL` (pas dans le cron Hobby) :

```bash
npm run history:ngx
# npm run history:ngx -- --from=2021-10-27 --limit=5
# npm run history:ngx -- --indices=off --charts=off
```

`npm run history:ngx` charge `scripts/register-paths.cjs` pour que ts-node résolve l'alias `@/`. Le même enregistrement est dans `tsconfig.json` (`ts-node.require`).

Reprise : `.cache/ngx-backfill.json`. Une date avec au moins 80 clôtures canoniques NGX est sautée. Les 404 (jours fériés) ne sont pas retéléchargés. Journal : `ingestion_logs.errors.kind = NGX_HISTORY`.

Volume visé : ~146 titres × ~250 séances × 5 ans ≈ 180 000 cours, plus des `chart_series` compactes. Aucun PDF en base. Rester sous ~200 Mo sur le palier gratuit Supabase (base ~70 Mo avant NGX).

Le taux EUR→NGN n'a pas d'historique gratuit : seule la séance courante est stockée dans `fx_rates`.

## Colliers et opérations sur titres

Collier BRVM 7,5 % (inchangé). Collier NGX ±10 % (`NGX_PRICE_COLLAR_PERCENT`). Un fractionnement ou un bonus NGX se déclare dans `corporate_actions` avec le `companyId` de la société NGX : le catalogue BRVM ne s'applique pas à un homonyme. Les cours bruts ne sont pas réécrits.

## Tickers

`ticker` reste unique globalement (aucune collision BRVM/NGX au 27/10/2026). La clé métier est `(exchange, ticker)`. Un symbole NGX déjà pris par la BRVM est ignoré et signalé, jamais écrasé.
