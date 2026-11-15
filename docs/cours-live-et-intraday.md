# Cours « live » et ingestion intrajournalière

## Pourquoi un cours affiché pouvait rester ancien des heures (cas SLBC, 12/11/2026)

1. 12:50 UTC — l'ouverture du portefeuille appelle `POST /api/market/refresh-quotes` :
   brvm.org est lu **en pleine séance**, le cours provisoire de SLBC est enregistré
   comme ligne canonique BRVM du 12/11.
2. 17:12 UTC — cron quotidien : brvm.org en échec (`FAILED`), la ligne du 12/11 garde
   le cours provisoire ; le cache graphe `chart_series` est reconstruit avec lui.
3. 18:58 UTC — nouvel « Actualiser » : la ligne du 12/11 passe à la clôture officielle
   (42 945 FCFA, +7,36 %), les alertes sont évaluées → notification à 19:00 UTC avec
   le bon cours.
4. Mais la fiche, la liste Marché et le portefeuille lisent le **dernier point de
   `chart_series`** (fiche : cache MAX ; listes : cache SPARK, via
   `pricesSyncedToLatestClose`). La superposition du dernier cours ne se faisait que
   pour une **date plus récente** : même date + cours corrigé = ignoré. Le tip du cron
   (`tipLatestChartPoints`) n'écrivait lui aussi que les séances nouvelles. Le bon cours
   n'est apparu qu'au cron suivant (13/11, 17:13 UTC), ~22 h plus tard.

## Ce qui est en place

- Source unique : `lib/quotes/latest-quotes.ts` (2 dernières clôtures canoniques par
  société, comme les notifications), mise en cache serveur (étiquettes `quotes`,
  `quotes:BRVM|NGX`, `quote:TICKER`), invalidée à chaque écriture de cours
  (`lib/cache/revalidate-quotes.ts`).
- Le dernier point des séries (fiche, aperçus) est aligné sur ce cours, y compris une
  correction le même jour (`lib/charts/overlay-latest-close.ts`) ; le tip du cron
  réécrit aussi la dernière séance corrigée.
- `GET /api/quotes?market=BRVM|NGX&tickers=…` + `useLiveQuotes` : 60 s en séance
  (BRVM 09:00–15:30 UTC, NGX 09:30–14:30 Lagos), 5 min après la clôture, 30 min sinon,
  rien le week-end ; relecture au retour sur l'onglet et dès qu'une notification arrive
  ou est ouverte.

## Ingestion intrajournalière (non programmée)

`GET /api/cron/refresh-quotes?market=BRVM|NGX|ALL&alerts=0|1[&force=1]`, protégé par
`CRON_SECRET`. Hors séance (et le week-end) la place est ignorée sans requête vers la
source. Aucune entrée dans `vercel.json` (plan Hobby : crons quotidiens seulement).

| Option | Avantages | Inconvénients |
|---|---|---|
| GitHub Actions `schedule` (toutes les 15–30 min, lun–ven) appelant l'URL | Gratuit, déjà sur GitHub, aucun réglage Vercel | `CRON_SECRET` à copier en secret du dépôt (accord requis) ; horaires GitHub parfois décalés de 5–15 min |
| Supabase `pg_cron` + `pg_net` | Tout dans Supabase | Le secret vit dans la base ; extensions à activer ; consomme le projet gratuit |
| Service cron externe (cron-job.org, etc.) | Simple, précis à la minute | Tiers qui détient le secret |
| Vercel Pro | Crons natifs à la minute | Payant (~20 $/mois) |

Écritures par passage : ~48 lignes BRVM (+ ~146 NGX) en upsert — de l'entrée, pas de
la sortie. Sortie base par passage avec `alerts=0` : quelques dizaines de Ko (lecture
des sociétés + rapprochement) ; avec `alerts=1`, l'évaluation des alertes relit
davantage (plusieurs centaines de Ko à quelques Mo) : la garder au cron quotidien et
aux boutons, ou à un passage sur deux.
