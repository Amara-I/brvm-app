# AGENTS.md — Agent de développement · BRVM App

> Ce fichier est le **cerveau persistant** de l'agent de développement de ce dépôt.
> Tout agent (Cursor ou humain) qui travaille ici doit le lire en premier et
> s'y référer avant toute modification structurante. Il est complété par les
> règles `.cursor/rules/*.mdc` (contraintes strictes, toujours appliquées).

---

## 1. Contexte du projet

**BRVM App** est une application d'analyse financière pour la **BRVM** (Bourse
Régionale des Valeurs Mobilières, Afrique de l'Ouest / zone UEMOA).

- **Dépôt GitHub** : https://github.com/Amara-I/brwm-app
- **Déploiement actuel** : https://brvm-app.vercel.app/fr
- **Référence UX/produit (À NE PAS COPIER VISUELLEMENT)** : https://ouestbourse.com/fr/
- **Composant de référence fonctionnelle** : [`reference/BRVM_Dashboard.jsx`](reference/BRVM_Dashboard.jsx)
  (copie figée du fichier fourni le 09/08/2026 — **ne pas modifier ce fichier**,
  il sert de spécification vivante du rendu visuel et des calculs attendus).

### ⚠️ Constat important sur l'état du dépôt (09/08/2026)

Le contenu actuel du dépôt cloné (`frontend/index.html.txt`) est un **placeholder
statique très basique** (5 sociétés en dur, HTML/CSS/JS vanilla, thème clair) —
il ne correspond **ni** au dashboard riche décrit dans `reference/BRVM_Dashboard.jsx`
(18+ sociétés, 4 onglets, thème sombre premium, Recharts, export Excel), **ni**
au rendu visible sur https://brvm-app.vercel.app/fr. Il est probable que le
déploiement Vercel utilise une branche/version différente de celle présente sur
`main`, ou que le vrai code source du dashboard n'ait pas encore été poussé sur
GitHub. **À clarifier avec le porteur du projet avant de pousser du code** —
en attendant, ce dépôt local sert de base de travail pour reconstruire
proprement l'application en s'alignant sur `reference/BRVM_Dashboard.jsx`.

---

## 2. Contraintes NON NÉGOCIABLES (rappel — voir aussi `.cursor/rules/`)

1. **Ne jamais modifier** : la palette de couleurs (objet `C` du JSX), la police
   (`'Trebuchet MS', Georgia, serif`), les textes en français, les emojis/icônes
   des onglets, ni la disposition sidebar/tabs actuelle.
2. Le design visuel final reste celui de `brvm-app.vercel.app` — **pas** un clone
   visuel de `ouestbourse.com`. Ouestbourse n'est une inspiration que pour :
   l'architecture data/produit, le niveau de finition fonctionnelle, la structure
   de nav (Marché, Screener, Portefeuille, Graphes, Sociétés cotées, Actualités,
   Outils, Connexion), et les micro-interactions (badges, stats de pied de page).
3. Toute nouvelle fonctionnalité est **incrémentale** et compatible avec le
   composant existant — ne jamais casser un onglet déjà fonctionnel.
4. **Fiabilité des données** : BRVM.org = source de vérité n°1, puis
   Sikafinance, puis Richbourse. Toute divergence > 2 % entre sources est
   journalisée dans `data_discrepancies` pour audit manuel. Donnée manquante
   → toujours afficher `"N/D"` (jamais `null`/`undefined` brut côté UI).
5. Scraping respectueux : rate limiting, User-Agent identifiable, respect du
   `robots.txt`, cache local, gestion des erreurs 403/429/500. Privilégier une
   API/flux officiel si disponible plutôt que du scraping HTML.

---

## 3. Stack technique retenue

| Domaine | Choix |
|---|---|
| Frontend | React/JSX existant → migration progressive vers Next.js (App Router) |
| Backend | Next.js API Routes (ou service Node/Express séparé si besoin de cron dédié) |
| Base de données | PostgreSQL (Supabase ou Neon) |
| ORM | Prisma |
| Auth | NextAuth.js (email/password + Google) |
| Cache | Redis / Vercel KV pour les données de marché fréquemment lues |
| Validation | Zod |
| Tests | Vitest (ou Jest) pour `calcMetrics`, `projectPrices`, `linearRegression` |
| Export Excel | `xlsx`, migré côté serveur (`GET /api/export/excel`) |
| Ingestion | Connecteurs isolés par source + cron (Vercel Cron / node-cron) |

---

## 4. Sources de données & priorité de réconciliation

| Priorité | Source | Rôle |
|---|---|---|
| 1 (source de vérité) | https://www.brvm.org/fr | Cours de clôture officiels, indices, avis, calendrier dividendes |
| 2 | https://www.sikafinance.com/ | Actualités, analyses, cours en léger différé, historique |
| 3 | https://www.richbourse.com/ | Croisement PER, capitalisation, ratios |
| Fallback | Interface admin / script CLI manuel | Correction si les 3 sources échouent |

Connecteurs prévus (isolés, désactivables indépendamment) :
`brvm_connector.ts`, `sikafinance_connector.ts`, `richbourse_connector.ts`.

Chaque donnée stockée porte un champ `source` (`brvm_org | sikafinance |
richbourse | manuel`) pour traçabilité complète (affiché en UI : "Source :
BRVM officiel").

---

## 5. Feuille de route (traiter une étape à la fois)

- [x] **Étape 1** — Schéma Prisma complet (`prisma/schema.prisma`) — **livré le 09/08/2026**
- [x] **Étape 2** — Script de migration `COMPANIES_FULL` (JSX) → `seed.ts` Prisma — **livré le 09/08/2026**
      (`prisma/seed-data/companies-full.ts` + `prisma/seed.ts`, idempotent, testé par
      compilation TS stricte + comptage à blanc : 20 sociétés, 5 pays, 7 secteurs,
      214 lignes de cours, 213 lignes de dividendes — 0 perte vs. le JSX d'origine.
      ⚠️ Non exécuté sur une vraie base PostgreSQL faute de Docker Desktop actif ;
      à valider avec `npx prisma migrate dev && npx prisma db seed` dès qu'une
      `DATABASE_URL` réelle — ou Docker local — est disponible.)
- [x] **Étape 3** — Prototype des 3 connecteurs d'ingestion (indices du jour + 2-3 tickers test) — **livré et testé en réel le 09/08/2026**
      (`lib/ingestion/` : `http-client.ts` (rate limit + retry + cache disque),
      `robots.ts` (vérif. robots.txt via `robots-parser`), `reconciliation.ts`
      (logique de priorité + détection d'écart >2%, 8 tests Vitest ✅),
      `connectors/{brvm,sikafinance,richbourse}_connector.ts`,
      `scripts/ingest-prototype.ts`. Exécuté avec succès contre les 3 sites
      réels (`npm run ingest:prototype`) le 09/08/2026 :
        - BRVM.org : 12 indices + 3/3 tickers test (SNTS/SGBC/ORAC) ✅ (source de vérité, structure HTML documentée en commentaire)
        - Sikafinance : 2 indices publics (BRVM Composite, Sika Total Return) ; **0/3 cotations par société** — aucun endpoint public non-gated confirmé pour les cours par ticker (leur robots.txt interdit explicitement `/listes/displaylist`, probablement l'ancienne page de listing) → limitation documentée dans le connecteur, à réévaluer avant l'étape 6
        - Richbourse : 18 indices + 3/3 tickers test (valeurs identiques à BRVM.org, écart 0%) ✅ via `/common/mouvements/index/{ticker}` (extraction depuis un graphique Highcharts embarqué — fragile par nature, à durcir avant industrialisation) ; leurs fiches "analyse société" détaillées restent verrouillées Premium
        - Réconciliation : priorité BRVM_OFFICIEL > SIKAFINANCE > RICHBOURSE appliquée correctement, 0 écart >2% détecté sur ce run
      ⚠️ Le prototype n'écrit PAS en base (aucune DATABASE_URL réelle
      disponible) — persistance prévue à l'étape 6.
- [x] **Étape 4** — API routes Next.js (pagination, filtres, cache) — **livré et testé le 09/08/2026**
      (Next.js 14 App Router scaffoldé : `app/api/companies` (GET, filtres
      secteur/pays, tri, pagination), `app/api/companies/[ticker]` (GET,
      historique complet + source + dernière synchronisation),
      `app/api/market/summary` (GET, indices + top hausses/baisses),
      `app/api/market/news` (GET, pagination). Validation Zod
      (`lib/api/query-schemas.ts`), cache HTTP `Cache-Control: s-maxage`
      (`lib/api/response.ts`), requêtes "dernière valeur canonique"
      factorisées (`lib/api/latest-data.ts`).
      ✔ `next build` : compilation + type-check stricts OK sur les 4 routes.
      ✔ Testé en réel via `next dev` : validation Zod confirmée (422 avec
      détail des champs sur paramètre invalide) ; les 500 obtenus sur les
      routes dépendant de la base sont bien dus à l'absence de PostgreSQL
      réel (`Can't reach database server`), pas à un bug de code — à
      revalider de bout en bout dès qu'une vraie `DATABASE_URL` est branchée.
      ⚠️ Différés sciemment à des étapes ultérieures (annoncés à l'utilisateur) :
      `GET /api/companies/:ticker/projections` et `GET /api/export/excel`
      (étape 5, nécessitent le port backend de calcMetrics/projectPrices/
      exportToExcel), `POST /api/portfolio` (étape 7, nécessite l'auth NextAuth).
      Ajout au schéma : `MarketIndexValue.isCanonical` (oublié à l'étape 1,
      nécessaire pour la réconciliation multi-source des indices).
- [x] **Étape 5** — Port backend TS strict de `calcMetrics` / `projectPrices` /
      `linearRegression` / `exportToExcel` + tests unitaires — **livré et testé le 09/08/2026**
      (Méthode de non-régression : `lib/calc/__fixtures__/generate-golden-fixtures.ts`
      exécute une copie VERBATIM du code JSX d'origine sur les 20 sociétés seed et
      produit `golden-legacy-output.json`, utilisé comme oracle par les tests.)
      - `lib/calc/linear-regression.ts` — régression linéaire, formule identique.
      - `lib/calc/project-prices.ts` — projections 3/5/7/10 ans (±15% opt./pess.),
        paramétrée (`futureYears`, `baseYear`) au lieu des millésimes 2026 codés en dur.
      - `lib/calc/calc-metrics.ts` — perf 5/10 ans, rendement dividende, volatilité,
        risque, score, signal ACHAT/VENTE ; formules ET artefacts du JSX préservés à
        l'identique (ex : risque retombe sur "Élevé" si volatilité "N/D", diviseur "12"
        du bonus dividendes) et documentés en commentaire plutôt que "corrigés en
        silence", pour ne rien changer au rendu actuel.
      - `lib/calc/export-workbook.ts` — classeur Excel 3 feuilles (Données BRVM /
        Projections / Classements), généré **côté serveur** (Buffer, plus de
        `XLSX.writeFile` navigateur) et exposé via `GET /api/export/excel`
        (filtrable par `sector`/`country`, données canoniques en base).
        🐛 **Un bug réel du JSX a été corrigé** (pas juste reproduit) : la feuille
        "Projections" désalignait les colonnes "20XX Pess." avec les mauvaises
        années (ex. la colonne "2027 Pess." contenait en fait `proj[1].projected`).
        Les en-têtes étaient corrects, seul le calcul des valeurs était faux. Corrigé
        ici pour respecter le principe n°4 (fiabilité des données) — **à signaler à
        l'utilisateur**, il peut demander de revenir au comportement bugué à
        l'identique si un usage externe dépendait de cet ordre de colonnes.
      - `GET /api/companies/:ticker/projections?years=` — nouvelle route (annoncée
        comme différée à l'étape 5 lors de l'étape 4), branchée sur les cours
        canoniques en base.
      - Dépendance `xlsx` installée depuis le **CDN officiel SheetJS**
        (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) plutôt que le
        registre npm : la version npm porte 2 CVE high (prototype pollution,
        ReDoS) sans fix publié sur npm. Usage ici en ÉCRITURE SEULE depuis des
        données internes de confiance (jamais de parsing de fichier utilisateur),
        donc hors périmètre des CVE — mais le choix du paquet est documenté par
        prudence (cf. commentaire en tête de `lib/calc/export-workbook.ts`).
      ✔ 56/56 tests Vitest ✅ (dont 40 tests de non-régression paramétrés sur les
      20 sociétés × `calcMetrics`/`projectPrices`) · `tsc --noEmit` ✅ · `next build` ✅
      (8 routes API compilées, dont les 2 nouvelles de cette étape).
- [x] **Étape 6** — Cron d'ingestion multi-source complet (logs, écarts, alertes) — **livré le 09/08/2026**
      (Industrialise le prototype de l'étape 3 : toutes les sociétés actives en base sont
      désormais interrogées, plus seulement 2-3 tickers test.)
      - `lib/ingestion/connector-config.ts` — feature flags par connecteur/opération
        (`INGESTION_ENABLE_*`), pour désactiver une source en urgence sans redéployer
        (répond explicitement au brief). Cotations Sikafinance **désactivées par
        défaut** (aucun endpoint public confirmé, cf. étape 3 — éviter le spam de 404).
      - `lib/ingestion/status.ts` — dérivation pure SUCCESS/PARTIAL/FAILED du statut
        d'une source à partir de ses appels (indices/cotations), 5 tests Vitest ✅.
      - `lib/ingestion/alerts.ts` — alerting best-effort (console toujours, + webhook
        générique Slack/Discord/Teams si `INGESTION_ALERT_WEBHOOK_URL` configuré),
        ne fait jamais échouer le run si l'envoi échoue.
      - `lib/ingestion/prisma-mappers.ts` + `persist.ts` — persistance des cotations
        brutes de CHAQUE source dans `price_history`/`market_index_values` (aucune
        perte, traçabilité complète), puis marquage `isCanonical` de la seule valeur
        retenue par la réconciliation ; écarts >2% journalisés dans
        `data_discrepancies` (`resolved: true`, résolution automatique par la règle
        de priorité).
      - `lib/ingestion/run-full-ingestion.ts` — orchestrateur : chaque connecteur
        tourne dans son propre try/catch (l'échec total d'une source, ou même un bug
        inattendu, n'empêche jamais les deux autres de s'exécuter), journalisation
        dans `ingestion_logs` (RUNNING → SUCCESS/PARTIAL/FAILED), alerte automatique
        si une source échoue complètement, si des écarts sont détectés, ou si un
        ticker inconnu apparaît côté source.
      - `GET /api/cron/ingest` — point d'entrée protégé par `CRON_SECRET` (vérifie
        `Authorization: Bearer` injecté par Vercel Cron, ou `?secret=` pour un
        déclenchement manuel), `maxDuration: 300` (rate limiting respectueux =
        run potentiellement long). **Testé en réel via `next dev`** : 401 sans
        secret ✅, 401 avec mauvais secret ✅, 500 avec le bon secret dû à l'absence
        de PostgreSQL réel (comportement identique aux étapes 4/5, alerte critique
        bien émise en console) ✅.
      - `vercel.json` — cron `30 16 * * 1-5` (16h30 GMT, lun-ven, après clôture BRVM).
      - `scripts/run-ingestion-cli.ts` — exécution manuelle (rattrapage incident, debug local).
      - `scripts/manual-correction.ts` — **fallback manuel** (brief : "si les 3
        sources échouent") : CLI `price|dividend|ratio <TICKER> ...` insérant une
        donnée `source=MANUEL` qui devient immédiatement canonique.
      ✔ 61/61 tests Vitest ✅ · `tsc --noEmit` ✅ · `next build` ✅ (9 routes API).
      ⚠️ Non exécuté de bout en bout contre une vraie base/vrais sites en conditions
      cron réelles (pas de `DATABASE_URL` réelle disponible ici) — à valider dès
      qu'une base Postgres + déploiement Vercel réels sont branchés.
- [x] **Étape 7** — Auth NextAuth + modèle "Portefeuille" (positions, valeur, secteurs, YTD) — **livré et testé le 09/08/2026**
      - `lib/auth/auth-options.ts` — NextAuth.js v4 : `CredentialsProvider` (email/mdp,
        bcrypt) + `GoogleProvider` (activé seulement si `GOOGLE_CLIENT_ID`/`SECRET`
        renseignés), session JWT (obligatoire avec Credentials), `PrismaAdapter`
        branché pour la persistance des comptes OAuth. `types/next-auth.d.ts` étend
        `Session`/`JWT` avec `id`/`role`.
      - `app/api/auth/[...nextauth]/route.ts` — handler NextAuth standard.
      - `POST /api/auth/register` — inscription email/mdp (NextAuth Credentials ne
        gère pas la création de compte), mot de passe haché (bcrypt, 12 rounds),
        validation Zod (email valide, mdp ≥ 8 caractères), 409 si email déjà utilisé.
      - `lib/calc/portfolio-metrics.ts` — logique PURE (valeur totale, plus/moins-value
        latente vs. prix moyen d'achat, répartition sectorielle pour donut chart façon
        Ouestbourse, performance YTD), 5 tests Vitest ✅. Simplification assumée et
        documentée en commentaire : le schéma ne conserve qu'une position courante
        (pas de grand livre de transactions), donc le YTD compare la valeur actuelle
        des positions DÉTENUES AUJOURD'HUI à leur valeur théorique au dernier cours de
        clôture de l'année précédente (légère surestimation si achat en cours d'année).
      - `lib/api/latest-data.ts` — ajout de `getYearStartCanonicalPrices` (référence
        "début d'année" pour le YTD).
      - `GET/POST /api/portfolio` — liste les portefeuilles de l'utilisateur connecté
        avec métriques calculées à la volée ; crée un portefeuille ou renomme un
        existant.
      - `POST /api/portfolio/:id/holdings` — ajoute une position (renforce une
        position existante avec prix moyen pondéré recalculé, sinon en crée une).
      - `PATCH/DELETE /api/portfolio/:id/holdings/:holdingId` — allègement partiel
        (`quantitySold`, suppression automatique si la vente est totale, conforme au
        commentaire du schéma Prisma) ou retrait complet d'une position.
      ✔ 66/66 tests Vitest ✅ · `tsc --noEmit` ✅ · `next build` ✅ (13 routes API).
      ✔ **Testé en réel** via `next dev` : `GET /api/portfolio` sans session → 401 ✅ ;
      `POST /api/auth/register` avec body invalide → 422 avec détail des champs
      (Zod) ✅ ; avec body valide → 500 dû à l'absence de PostgreSQL réel (comportement
      identique aux étapes précédentes, pas un bug de code) ✅.
      ⚠️ Non testé de bout en bout avec une vraie base (flux complet inscription →
      connexion → session → création de portefeuille) — à valider dès qu'une
      `DATABASE_URL` réelle est branchée. Page de connexion/inscription UI encore à
      créer (prévue à l'étape 8, façon Ouestbourse : "Connexion/Créer un compte").
- [x] **Étape 8** — Adapter `BRVM_Dashboard.jsx` pour consommer les API (même rendu strict) — **livré et testé le 09/08/2026**
      - `lib/api/companies-full-dataset.ts` — reconstitue la forme de
        `COMPANIES_FULL` du JSX à partir des données CANONIQUES en base
        (`isCanonical: true`, post-réconciliation multi-source, cf. étape 6), avec
        deux champs additionnels demandés par le brief : `dataSource` et
        `lastSyncedAt` (source/horodatage de la donnée canonique la plus récente,
        cours OU dividende, pour chaque société). Les années couvertes (`years`)
        sont dérivées des données réellement présentes, plus aucun `YEARS`/`2026`
        codé en dur.
      - `GET /api/companies/full` — expose ce même jeu de données pour les
        rafraîchissements côté client (mise en cache 30s + SWR 60s).
      - `components/BrvmDashboardClient.tsx` — **port fidèle, ligne par ligne, du
        composant `reference/BRVM_Dashboard.jsx`** (relu intégralement avant
        portage pour garantir l'exactitude) : palette `C`, police, tous les textes
        français, les 4 onglets (Vue d'ensemble / Courbe historique / Projection
        future / Comparaison), la sidebar de filtres/tri, les tableaux et graphiques
        Recharts, le footer légal — strictement identiques au caractère et au pixel
        près. Réutilise les MÊMES fonctions `calcMetrics`/`projectPrices` que les
        API routes et l'export Excel serveur (étape 5), donc zéro duplication de
        logique métier front/back (exigence explicite du brief). Différences
        strictement additives et non-visuelles :
          - Table statique `COMPANIES_FULL` remplacée par les props reçues du
            serveur (`initialData`) + rafraîchissement réel via
            `GET /api/companies/full` (au lieu du `setTimeout` factice d'origine).
          - Export Excel : appelle désormais `GET /api/export/excel` (génération
            serveur, cf. étape 5) au lieu de `xlsx` côté navigateur.
          - **Ajout demandé par le brief** : indicateur discret "Source :
            {BRVM officiel|Sikafinance|Richbourse|Saisie manuelle} · Synchronisé le
            {date/heure}" sous le cours actuel de chaque société (onglet Vue
            d'ensemble uniquement, taille de police 0.58rem, couleur `textDim` —
            aucun élément visuel existant déplacé/modifié).
          - Les rares millésimes codés en dur (ex. "2015 → 2026", `2026` comme
            année de référence des projections) utilisent désormais les années
            réellement présentes en base (`years[0]`/`years[years.length-1]`) —
            seuls les NOMBRES affichés changent si les données changent, jamais le
            texte/la mise en forme.
          - Société et 3 tickers de comparaison pré-sélectionnés par défaut :
            comportement identique au JSX d'origine (`"SNTS"` /
            `["SNTS","CBIBF","SGBC"]`) tant qu'ils existent dans le jeu de données ;
            repli sur les premières sociétés disponibles sinon (cas d'une base pas
            encore re-seedée avec l'échantillon d'origine).
          - État vide géré proprement (message discret) si la base ne contient
            encore aucune société, cas qui n'existait pas avec le tableau statique.
      - `app/page.tsx` — Server Component : appelle `getCompaniesFullDataset()`
        DIRECTEMENT (pas d'auto-fetch HTTP sur le premier rendu) et transmet le
        résultat à `BrvmDashboardClient`.
      - Dépendance `recharts` installée (utilisée par le JSX d'origine, absente du
        `package.json` Next.js jusqu'ici).
      ✔ `tsc --noEmit` ✅ · `next build` ✅ (compilation réussie, page `/` générée en
      mode dynamique `ƒ`, 14 routes au total). Non testé en conditions réelles avec
      une vraie base de données (même limitation que les étapes précédentes, pas de
      `DATABASE_URL` réelle disponible ici) — le rendu visuel exact reste à valider
      à l'œil une fois une base Postgres réelle branchée et seedée.
- [x] **Étape 9** — Checklist conformité (sécurité, a11y, perf, RGPD, disclaimers) — **livré et testé le 09/08/2026**
      - `COMPLIANCE_CHECKLIST.md` — document principal de cette étape : checklist
        détaillée par catégorie (sécurité, a11y, performance, RGPD, disclaimers/
        mentions légales), avec état ✅/🟡/⬜ et actions restantes avant mise en
        production réelle.
      - `next.config.mjs` — en-têtes de sécurité HTTP (`headers()`) : CSP de base,
        `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
        `Permissions-Policy`, `Strict-Transport-Security`.
      - `middleware.ts` + `lib/security/rate-limit.ts` (4 tests Vitest) — rate
        limiting par IP sur `/api/**` (60 req/min générique, 10 req/min sur
        `/api/auth/**`). Limite connue et documentée : implémentation en mémoire,
        à remplacer par Redis/Vercel KV avant une mise en prod à fort trafic
        multi-instances.
      - `app/layout.tsx` + `app/globals.css` — lien d'évitement ("skip to
        content") et repère `<main>`, sans toucher au dashboard lui-même.
      - `components/BrvmDashboardClient.tsx` — rôles ARIA (tabs, listes,
        boutons à bascule), navigation clavier de la sidebar de sociétés
        (bug d'accessibilité hérité du JSX corrigé : `<div onClick>` sans
        support clavier), `scope="col"` sur les 3 tableaux. **Aucun changement
        visuel ni textuel** — uniquement des attributs additifs.
      - `app/mentions-legales/page.tsx` — nouvelle page autonome (RGPD,
        disclaimer financier renforcé, origine détaillée des données BRVM/
        Sikafinance/Richbourse). Lien discret ajouté dans le footer du
        dashboard **après validation explicite de l'utilisateur** (texte
        d'origine conservé intégralement, lien ajouté à la suite : `· Mentions
        légales`, cf. `components/BrvmDashboardClient.tsx`).
      - `app/robots.ts` — `robots.txt` généré, exclut `/api/**` du crawl.
      ✔ `tsc --noEmit` ✅ · `vitest run` (70/70 tests) ✅ · `next build` ✅
      (middleware 26,9 kB inclus, 16 routes + `/robots.txt`).
      ⚠️ Points nécessitant un vrai navigateur/une vraie infra pour être validés
      (non faisables dans cet environnement) : audit de contraste/focus clavier
      réel, vérification que la CSP ne casse pas Recharts, mesure Core Web
      Vitals — listés comme actions restantes dans `COMPLIANCE_CHECKLIST.md` §7.

- [x] **Relecture complète du projet (post-étape 9)** — **effectuée le 09/08/2026**
      Relecture méthodique de `prisma/schema.prisma`, du pipeline d'ingestion
      complet (`reconciliation.ts`/`persist.ts`/`run-full-ingestion.ts`), des
      routes API (`companies`, `market/summary`, `portfolio*`, `export/excel`),
      de `lib/calc/portfolio-metrics.ts` et de `auth-options.ts`.
      🔴 **Bug de sécurité réel trouvé et corrigé** : `GET /api/portfolio`
      (données personnalisées par utilisateur) utilisait par erreur
      `cacheHeaders()` → `Cache-Control: public, s-maxage=30`, ce qui aurait pu
      permettre à un cache PARTAGÉ (CDN) de resservir le portefeuille d'un
      utilisateur à un autre pendant la fenêtre de cache. Corrigé avec une
      nouvelle fonction `privateCacheHeaders()` (`lib/api/response.ts`),
      appliquée à cette route (`Cache-Control: private, no-store`). Toutes les
      autres routes utilisant `cacheHeaders()` ont été revérifiées : elles ne
      retournent que des données de marché publiques, aucun risque similaire.
      Documenté dans `COMPLIANCE_CHECKLIST.md` § Sécurité.
      Aucun autre problème structurel trouvé : schéma cohérent, logique de
      réconciliation/persistance correcte (invariant "une seule ligne
      canonique par société/date" bien maintenu), autorisations IDOR
      correctes sur toutes les routes `/api/portfolio/**`.
      ✔ `tsc --noEmit` ✅ · `vitest run` (70/70 tests) ✅ après correction.

**→ Les 9 étapes de la feuille de route initiale sont maintenant livrées.**

- [x] **Validation de bout en bout sur PostgreSQL réel (Docker local)** — **effectuée le 09/08/2026**
      Toutes les réserves "⚠️ non testé faute de `DATABASE_URL` réelle" des
      étapes 1 à 9 sont désormais levées : `docker-compose.yml` (Postgres 16)
      démarré localement, `npx prisma migrate dev --name init` (migration
      appliquée sans erreur) puis `npx prisma db seed` — résultat identique à
      celui annoncé à l'étape 2 (20 sociétés, 5 pays, 7 secteurs, 214 lignes de
      cours, 213 dividendes, 0 perte), toutes marquées `isCanonical: true`
      (source `MANUEL`, seed initial). `next dev` lancé et testé en réel :
      - Rendu visuel du dashboard (`app/page.tsx` + `BrvmDashboardClient`)
        vérifié à l'écran (capture) sur les 4 onglets (Vue d'ensemble, Courbe
        historique — Recharts, Projection future — 3 scénarios + repère
        "Aujourd'hui", Comparaison — sélection par défaut SNTS/CBIBF/SGBC) :
        conforme pixel pour pixel à `reference/BRVM_Dashboard.jsx` (palette,
        police, textes, emojis, disposition sidebar/tabs). Indicateur
        "Source : Saisie manuelle · Synchronisé le ..." bien affiché (étape 8).
      - `GET /api/export/excel` → fichier `.xlsx` valide généré (56 Ko).
      - Flux auth + portefeuille complet (jamais testé de bout en bout avant,
        étape 7) : inscription (`POST /api/auth/register` → 201) → connexion
        NextAuth Credentials (`POST /api/auth/callback/credentials` → session
        JWT avec `id`/`role`) → création de portefeuille → ajout d'une
        position (SNTS, 10 titres @ 25 000 FCFA) → `GET /api/portfolio`
        renvoie les métriques calculées en temps réel (valeur de marché
        284 500, plus-value latente +34 500 soit +13.8 %, répartition
        sectorielle 100 % Télécoms, YTD +1.61 %) — confirme `calcMetrics`/
        `computePortfolioMetrics` corrects sur données réelles. En-tête
        `Cache-Control: private, no-store` confirmé sur cette route (validation
        en conditions réelles du correctif de sécurité de la relecture
        précédente).
      - Toutes les autres routes spot-checkées → 200 (`/api/market/summary`,
        `/api/market/news`, `/api/companies/:ticker`, `/api/companies/:ticker/projections`),
        401 correct sur `/api/portfolio` sans session, page `/mentions-legales` → 200.
      - `tsc --noEmit` ✅ · `vitest run` → 70/70 ✅ (inchangé, exécuté aussi
        contre l'environnement avec base réelle branchée).
      ⚠️ Un indicateur d'erreur transitoire du overlay de développement Next.js
      ("1 error", uniquement en mode `next dev`) a été observé de façon
      intermittente sans jamais empêcher le rendu ni être reproductible de
      façon déterministe (absent après rechargement propre, capture de
      `console.error`/`window.onerror`/`unhandledrejection` négative à chaque
      fois) — cohérent avec un avertissement bénin connu de Recharts
      (`ResponsiveContainer` mesurant un conteneur de largeur/hauteur 0 au tout
      premier rendu, avant que le layout ne soit stabilisé), qui n'existe pas
      en dehors du mode développement. Non bloquant, à garder à l'œil si
      constaté à nouveau après un `next build && next start` réel.
      Reste non couvert dans cet environnement (nécessite un vrai déploiement
      Vercel + cron) : `GET /api/cron/ingest` en conditions cron réelles contre
      les 3 sites sources, et le rendu face à un vrai trafic multi-instances
      (rate limiting en mémoire, cf. `COMPLIANCE_CHECKLIST.md`).

Prochaines priorités naturelles (à valider avec l'utilisateur, aucune n'a été
anticipée) : déploiement Vercel réel + base Postgres managée (Supabase/Neon)
pour remplacer le Docker local, activer le cron Vercel réel, et lever les
points ⬜/🟡 restants de `COMPLIANCE_CHECKLIST.md`.

---

## 7. Étape 10 — Landing page, navigation complète & agent de recherche IA

Demandée par l'utilisateur le 09/08/2026, en dehors de la feuille de route
initiale à 9 étapes (déjà entièrement livrée). Décisions validées
explicitement par l'utilisateur avant de commencer (cf. § 2 pour la
contrainte non-négociable modifiée en conséquence) :

1. **Landing page (`/`)** : clone visuel de `ouestbourse.com`, exception
   scoped à cette seule page (cf. `.cursor/rules/brvm-non-negotiable.mdc`) —
   le dashboard (`/marche`) et toutes les pages internes gardent la palette
   sombre/or existante.
2. **Agent de recherche IA** : une VRAIE fonctionnalité permanente (pas une
   recherche ponctuelle de l'agent de dev), un job planifié qui scanne le web
   pour proposer des pistes d'amélioration (UX, contenu, fonctionnalités,
   veille concurrentielle), sur le modèle des connecteurs d'ingestion
   existants (isolé, traçable, désactivable).
3. **Portée immédiate** : Landing page + toutes les pages du menu de
   navigation (au moins en version fonctionnelle minimale/stub honnête).

### 10.1 — Navigation & structure des pages

- `app/page.tsx` → nouvelle **Landing page** (`components/LandingPage.tsx`),
  seule page à déroger à la palette `C` du dashboard (cf. règle mise à jour).
  Contenu 100 % basé sur les vraies données (`getCompaniesFullDataset()`) :
  nombre réel de sociétés, années réellement couvertes, secteurs réels —
  jamais de chiffres inventés copiés de ouestbourse.com.
- L'ancien contenu de `app/page.tsx` (dashboard `BrvmDashboardClient`) déplacé
  tel quel vers **`app/marche/page.tsx`** (aucune modification du composant
  dashboard lui-même — contrainte non-négociable). Enveloppé par le nouveau
  `components/AppHeader.tsx` (nav sombre/or, additif, ne touche à aucun
  onglet/texte existant du dashboard).
- `components/AppHeader.tsx` — Server Component (lit la session NextAuth
  côté serveur via `getCurrentUser()`, pas de `SessionProvider` client requis)
  affichant les liens de nav (Marché/Screener/Portefeuille/Graphes/Sociétés
  cotées/Actualités/Outils) + Connexion/Inscription ou "Bonjour {nom} ·
  Déconnexion" si authentifié. Utilisé sur toutes les pages internes
  (`/marche`, `/screener`, `/societes-cotees`, `/actualites`, `/portefeuille`,
  `/graphes`, `/outils`, `/mentions-legales`), jamais sur la landing.
- Pages livrées avec de VRAIES données (pas de placeholder) car le backend
  existait déjà :
  - `app/societes-cotees/page.tsx` — liste complète des sociétés (ticker,
    nom, pays, secteur, cours actuel), à partir de `getCompaniesFullDataset()`.
  - `app/screener/page.tsx` — filtres rapides façon Ouestbourse (Rentabilité /
    Dividendes / Croissance / Valorisation), calculés à la volée avec
    `calcMetrics` (aucune duplication de logique, même fonction que `/marche`
    et l'export Excel).
  - `app/actualites/page.tsx` — branché sur la table `news_articles`
    existante (état vide honnête "Aucune actualité pour l'instant" tant que
    l'ingestion d'actualités n'a pas été implémentée — non promis dans la
    roadmap initiale).
  - `app/portefeuille/page.tsx` — si connecté : liste réelle des
    portefeuilles + métriques (réutilise l'API étape 7) ; sinon, invite à se
    connecter/créer un compte.
  - `app/connexion/page.tsx` / `app/inscription/page.tsx` — formulaires réels
    (`next-auth/react` `signIn("credentials")` / `POST /api/auth/register`
    existants depuis l'étape 7), thème sombre/or.
- Pages livrées en stub honnête (fonctionnalité pas encore développée,
  annoncée comme telle, pas de fausses données) :
  - `app/graphes/page.tsx` — "Bientôt disponible", renvoie vers les onglets
    Courbe historique/Comparaison de `/marche` en attendant.
  - `app/outils/page.tsx` — liste les outils déjà réels (Export Excel — lien
    direct vers `GET /api/export/excel`) et les suggestions de l'agent de
    recherche IA (§ 10.2) ; autres outils annoncés "Bientôt disponible".

### 10.2 — Agent de recherche IA permanent

Nouveau domaine `lib/research/`, conçu sur le même modèle que
`lib/ingestion/` (connecteurs isolés, feature flags, logs, alerting) mais pour
la VEILLE produit/UX plutôt que les données financières :

- `prisma/schema.prisma` — nouveau modèle `ResearchFinding` (requête source,
  titre, url, résumé, catégorie `UX | CONTENU | FONCTIONNALITE | CONCURRENCE`,
  statut `NOUVEAU | RETENU | REJETE | APPLIQUE`, horodatage) + enum associés.
- `lib/research/types.ts` — interface `SearchProvider` pluggable (comme
  `MarketDataConnector` pour l'ingestion).
- `lib/research/search-providers/no-op-provider.ts` — implémentation par
  défaut, SANS clé API, qui ne fait aucun appel réseau et retourne une liste
  vide (documentée en commentaire) : évite tout comportement surprenant tant
  qu'aucune clé n'est configurée.
- `lib/research/search-providers/serpapi-provider.ts` — implémentation réelle
  prête à l'emploi dès qu'une clé `RESEARCH_SEARCH_API_KEY` est renseignée
  (SerpAPI, Google Search). ⚠️ Non testée en conditions réelles dans cet
  environnement (aucune clé API disponible ici) — même limitation transparente
  que les connecteurs BRVM/Sikafinance/Richbourse au démarrage du projet.
- `lib/research/queries.ts` — jeu de requêtes de veille par défaut (UX fintech
  Afrique de l'Ouest, actualités BRVM, fonctionnalités des concurrents
  Ouestbourse/Sikafinance/Richbourse, accessibilité mobile), modifiable sans
  toucher à l'orchestrateur.
- `lib/research/run-research-agent.ts` — orchestrateur : exécute chaque
  requête via le provider configuré, déduplique par URL, persiste les
  nouvelles trouvailles, isolé par try/catch comme `run-full-ingestion.ts`
  (un échec du provider n'empêche jamais le reste de l'app de fonctionner).
- `GET /api/cron/research` — point d'entrée protégé par `CRON_SECRET` (même
  mécanisme que `/api/cron/ingest`), déclenchable manuellement ou via Vercel
  Cron (`vercel.json` — hebdomadaire, lundi 6h UTC, feature séparée du cron
  financier quotidien).
- `GET /api/research/findings` — liste paginée des trouvailles, consommée par
  `app/outils/page.tsx`.
- Feature flag `RESEARCH_AGENT_ENABLED` (défaut `false` tant qu'aucune clé
  API n'est configurée, pour ne jamais spammer un provider par erreur).

> Ne pas anticiper les étapes suivantes sans validation explicite de l'utilisateur
> entre chaque étape (contrainte explicite du brief projet).

---

## 6. Conventions de dépôt

- `reference/` — fichiers sources figés fournis par l'utilisateur (lecture seule,
  ne jamais éditer directement ; copier pour transformer).
- `prisma/` — schéma et migrations Prisma.
- `frontend/` — placeholder HTML historique du dépôt GitHub d'origine (cf. §1,
  jamais l'app réelle). Conservé tel quel à titre d'archive ; le vrai dashboard
  vit désormais dans `app/page.tsx` + `components/BrvmDashboardClient.tsx`
  (étape 8).
- Toute donnée financière codée en dur ne doit exister que dans `reference/`
  ou dans les scripts de seed — jamais dupliquée ailleurs "à la main".
