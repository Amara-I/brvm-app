# NGX — phase 1 (consultation)

La Nigerian Exchange est consultable sur `/marches/ngx` (liste, fiche, indices). Le portefeuille, le screener et les pages BRVM restent limités à `exchange = BRVM`. Les prix sont en naira (₦). Le montant FCFA est **indicatif** : XOF = 655,957 pour 1 EUR, EUR→NGN via [open.er-api.com](https://www.open.er-api.com) (attribution affichée). Ce n'est pas un fixing officiel.

## Après merge — pas de nouvelle migration

Ce lot n'ajoute aucun fichier dans `prisma/migrations/`. Le schéma NGX (`20261027190000_ngx_exchange_scope` : `exchange`, `currency`, `NGX_OFFICIEL`, `fx_rates`) est déjà sur `main` (PR #62) et déjà appliqué sur Supabase, enregistré dans `_prisma_migrations`. Ne pas le rejouer.

Le build Vercel utilise le migrate borné de la PR #63 (`scripts/try-migrate-deploy.cjs`, `DIRECT_URL`, timeout 120 s, pooler 6543 ignoré). Sans migration nouvelle, `migrate deploy` n'a rien à appliquer.

## Ingestion du jour

Le cron unique `0 17 * * *` UTC (après la clôture de Lagos, 14:30) appelle `runNgxDailyIngest` après la persistance BRVM, hors du lot Sikafinance/Richbourse. Plafond 25 s, étape sautée s'il reste moins de 12 s. Désactivation : `INGESTION_ENABLE_NGX=false`.

Source : JSON `doclib.ngxgroup.com/.../statistics/equities` (contrôle : 80–250 symboles, clôtures > 0, date de séance ≤ 10 jours). Sinon repli PDF « Daily Official List », puis « DAILY SUMMARY » apparié par raison sociale, avec alerte.

Les séries `chart_series` NGX sont rafraîchies dans le temps restant de cette étape.

## Historique 5 ans — sur Vercel

`npm run history:ngx` a besoin d'un Postgres joignable. Depuis une machine sans sortie vers la base, enchaîner `GET /api/cron/ngx-history` (secret `CRON_SECRET`, comme les autres `/api/cron/*`). Cette route n'est **pas** dans `vercel.json` : les créneaux cron Hobby sont déjà pris. `budgetMs` est plafonné à 240000 (la fonction est coupée à 300 s).

Pas de nouvelle migration.

```bash
# Séance du 27/10/2026 + taux EUR→NGN + chart_series NGX (sociétés et indices)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/ngx-history?date=27/10&budgetMs=240000"

# 5 ans, par paquets. Répéter tant que data.incomplete est true,
# en repassant data.next dans cursor.
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/ngx-history?from=2021-10-27&to=2026-10-27&limit=4&budgetMs=240000"
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/ngx-history?from=2021-10-27&to=2026-10-27&cursor=NEXT&limit=4&budgetMs=240000"

# Séries seules (après l'historique), reprise via data.chartsNext
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/ngx-history?limit=0&charts=1&fx=1&budgetMs=240000"
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/ngx-history?limit=0&charts=1&after=CHARTS_NEXT&budgetMs=240000"
```

Chaque réponse JSON porte `incomplete`, `next` (même valeur que `cursor`), `weekdayIndex` / `weekdayTotal`, `processed`, `quotes`, `failedDates`, `chartsIncomplete`, `chartsNext`. Une date avec au moins 80 clôtures canoniques NGX est sautée. Les 404 (fériés) sont mémorisés dans `ingestion_logs` (`errors.kind = NGX_HISTORY`, `absentDates`, `next`) — le disque Vercel ne survit pas d'un appel à l'autre. Délai minimum 2 s vers `doclib.ngxgroup.com`. Défaut du chunk : 4 séances, pas de charts ni de fx (le temps part aux PDF). `date=` télécharge une séance, enregistre le taux et rafraîchit les séries. `INGESTION_ENABLE_NGX=false` répond `skipped` sans appel réseau.

Avec `DATABASE_URL` en local, le même orchestrateur :

```bash
npm run history:ngx
# npm run history:ngx -- --from=2021-10-27 --limit=5
# npm run history:ngx -- --indices=off --charts=off
```

`npm run history:ngx` charge `scripts/register-paths.cjs` pour que ts-node résolve l'alias `@/`.

Volume visé : ~146 titres × ~250 séances × 5 ans ≈ 180 000 cours, plus des `chart_series` compactes. Aucun PDF en base. Rester sous ~200 Mo sur le palier gratuit Supabase (base ~70 Mo avant NGX).

Le taux EUR→NGN n'a pas d'historique gratuit : seule la séance courante est stockée dans `fx_rates`.

## Colliers et opérations sur titres

Collier BRVM 7,5 % (inchangé). Collier NGX ±10 % (`NGX_PRICE_COLLAR_PERCENT`). Un fractionnement ou un bonus NGX se déclare dans `corporate_actions` avec le `companyId` de la société NGX : le catalogue BRVM ne s'applique pas à un homonyme. Les cours bruts ne sont pas réécrits.

## Tickers

`ticker` reste unique globalement (aucune collision BRVM/NGX au 27/10/2026). La clé métier est `(exchange, ticker)`. Un symbole NGX déjà pris par la BRVM est ignoré et signalé, jamais écrasé.
