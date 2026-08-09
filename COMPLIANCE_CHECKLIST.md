# Checklist de conformité "standards internationaux" — BRVM App

> Étape 9 du plan de migration (cf. `AGENTS.md`). Ce document est **vivant** :
> à chaque évolution notable (nouvelle fonctionnalité, mise en production
> réelle), le mettre à jour plutôt qu'en créer un nouveau.
>
> Légende : ✅ fait & vérifié · 🟡 fait mais partiel/prototype · ⬜ à faire
> avant mise en production réelle.

---

## 1. Sécurité

| Point | État | Détail |
|---|---|---|
| HTTPS | 🟡 | Géré automatiquement par Vercel en production (certificat auto, redirection HTTP→HTTPS). Rien à coder côté app. **À vérifier** une fois le domaine réel branché : `NEXTAUTH_URL` doit être en `https://`. |
| En-têtes de sécurité HTTP | ✅ | `next.config.mjs` → `headers()` : `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. |
| CSP durcie (nonces, suppression `unsafe-inline`/`unsafe-eval`) | ⬜ | La CSP actuelle est un point de départ permissif (nécessaire pour Recharts/React dev overlay). **À durcir** après validation visuelle du dashboard dans un vrai navigateur (risque de casser silencieusement les graphiques SVG sans pouvoir le vérifier dans cet environnement sans affichage). |
| Rate limiting | 🟡 | `middleware.ts` + `lib/security/rate-limit.ts` : 60 req/min/IP sur `/api/**`, 10 req/min/IP sur `/api/auth/**` (anti-bruteforce). ⚠️ Implémentation **en mémoire par instance** — sur Vercel serverless multi-instances, la limite réelle appliquée est `limite × nb instances actives`, pas une limite globale stricte. **À faire avant prod à fort trafic** : brancher sur Redis/Vercel KV (`INCR`+`EXPIRE`), déjà prévu via `REDIS_URL` dans `.env.example`. |
| Validation/sanitization des entrées | ✅ | Zod sur tous les payloads API (`lib/api/query-schemas.ts`, schémas inline dans chaque route `POST`/`PATCH`) — cf. étapes 4/7. Aucune requête SQL brute (Prisma paramètre tout nativement, protection injection SQL de fait). |
| Hachage des mots de passe | ✅ | `bcryptjs`, 12 rounds (`app/api/auth/register/route.ts`). Jamais de mot de passe en clair en base ni en log. |
| Protection brute-force connexion | 🟡 | Rate limiting générique sur `/api/auth/**` (ci-dessus). **Manquant** : verrouillage de compte après N échecs, CAPTCHA. À évaluer selon le trafic réel observé. |
| CSRF | ✅ | Géré nativement par NextAuth.js pour le flux `CredentialsProvider` (token CSRF dans le formulaire de connexion). Les routes API custom (`POST /api/portfolio`, etc.) sont protégées par la vérification de session (pas de cookie = pas d'action), pas de cookie "ambient authority" exploitable en CSRF classique pour des routes JSON sans navigation. |
| Secrets / variables d'environnement | ✅ | `.env` dans `.gitignore` dès le départ ; `.env.example` ne contient que des placeholders. `CRON_SECRET`, `NEXTAUTH_SECRET` documentés comme "à générer aléatoirement" (`openssl rand -hex 32`). |
| Dépendances vulnérables | ✅ | `xlsx` : version npm ayant des CVE connues (prototype pollution, ReDoS) remplacée par le tarball officiel SheetJS patché (cf. `package.json`, documenté dans `lib/calc/export-workbook.ts`). **Recommandation continue** : exécuter `npm audit` régulièrement en CI. |
| Isolation des connecteurs de scraping | ✅ | Chaque connecteur (`lib/ingestion/connectors/*.ts`) tourne dans son propre try/catch (étape 6) — une source compromise/en erreur ne peut pas faire planter tout le cron. |
| Respect des tiers scrappés | ✅ | Rate limiting + `User-Agent` identifiable + respect de `robots.txt` + cache local avant toute requête (`lib/ingestion/http-client.ts`, `lib/ingestion/robots.ts`) — cf. étape 3. |
| En-têtes de sécurité sur les réponses API elles-mêmes | ✅ | Héritent des headers globaux (`next.config.mjs` s'applique à `/:path*`, y compris `/api/**`). |
| Autorisation par ressource (IDOR) | ✅ | Toutes les routes `/api/portfolio/**` filtrent par `userId` courant (`getCurrentUserId()`) avant toute lecture/écriture — impossible d'accéder au portefeuille d'un autre utilisateur en devinant un ID. |
| Cache CDN sur données personnalisées | ✅ **corrigé (relecture étape 9)** | `GET /api/portfolio` utilisait par erreur `cacheHeaders()` (→ `Cache-Control: public, s-maxage=30`), ce qui aurait pu conduire un cache PARTAGÉ (CDN Vercel Edge) à resservir le portefeuille d'un utilisateur à un AUTRE utilisateur pendant la fenêtre de cache. Corrigé avec une nouvelle fonction dédiée `privateCacheHeaders()` (`Cache-Control: private, no-store`) — cf. `lib/api/response.ts` et `app/api/portfolio/route.ts`. Toutes les autres routes utilisant `cacheHeaders()` (`/api/companies*`, `/api/market/*`) ont été revérifiées : elles ne retournent que des données de marché publiques, identiques pour tous les utilisateurs — pas de risque similaire. |

---

## 2. Accessibilité (a11y)

| Point | État | Détail |
|---|---|---|
| Langue de la page | ✅ | `<html lang="fr">` (`app/layout.tsx`). |
| Lien d'évitement ("skip to content") | ✅ | Ajouté dans `app/layout.tsx` + `app/globals.css` (WCAG 2.4.1 Bypass Blocks), invisible tant qu'il n'a pas le focus clavier. |
| Repère de navigation (landmark) | ✅ | `<main id="main-content">` autour du contenu applicatif. |
| Onglets du dashboard | ✅ | `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` + `role="tabpanel"` (`components/BrvmDashboardClient.tsx`) — navigable et compréhensible au lecteur d'écran, **sans aucun changement visuel**. |
| Sélecteurs (secteur, tri) | ✅ | `aria-label` explicite sur les `<select>` sans `<label>` visible. |
| Sélection d'une société (sidebar) | ✅ | Éléments cliquables convertis en cibles clavier accessibles (`role="button"`, `tabIndex={0}`, gestion `Enter`/`Espace`, `aria-pressed`) — **bug d'accessibilité réel hérité du JSX d'origine** (`<div onClick>` sans support clavier), corrigé sans toucher au rendu visuel. |
| Tableaux de données | ✅ | `scope="col"` sur tous les en-têtes `<th>` des 3 tableaux (historique, projections, comparaison). |
| Boutons à bascule (comparaison, horizon de projection) | ✅ | `aria-pressed` ajouté. |
| Emojis décoratifs (drapeaux) | 🟡 | `aria-hidden="true"` ajouté sur les occurrences les plus visibles (liste des sociétés, sélecteur de comparaison) ; le texte adjacent (ticker, nom) porte déjà l'information utile. **Non exhaustif** sur tout le fichier — passe complémentaire recommandée. |
| Contraste des couleurs | 🟡 | Fond très sombre (`#080B12`) + texte crème (`#E2D9C5`) : ratio de contraste élevé, probablement conforme AA. Certains textes secondaires (`textDim: #6B7280` sur fond sombre) sont **proches du seuil AA (4.5:1) pour du petit texte** — à mesurer avec un outil (ex. Chrome DevTools/axe) une fois le rendu visible dans un navigateur réel. Palette non-négociable : **aucune correction de couleur ne peut être appliquée sans validation explicite de l'utilisateur.** |
| Focus visible au clavier | 🟡 | Les éléments natifs (`<button>`, `<select>`) conservent l'outline navigateur par défaut (aucun `outline: none` dans le code). Non vérifié visuellement dans un vrai navigateur (pas d'affichage disponible dans cet environnement). |
| Textes alternatifs / rôles ARIA supplémentaires (graphiques Recharts) | ⬜ | Les graphiques SVG n'ont pas de résumé textuel équivalent (`aria-label` global décrivant la tendance). Amélioration possible future (ex. `<caption>` texte au-dessus de chaque graphique résumant la tendance), non faite ici pour rester strictement dans le périmètre "checklist + fondations". |
| Audit automatisé (axe-core / Lighthouse a11y) | ⬜ | Nécessite un navigateur réel — à exécuter dès qu'un déploiement Vercel de preview est disponible. |

---

## 3. Performance (Core Web Vitals)

| Point | État | Détail |
|---|---|---|
| Polices | ✅ | `'Trebuchet MS', Georgia, serif` = polices système, **aucun chargement de web font** → pas de CLS lié aux polices, pas de requête réseau supplémentaire. |
| Images | ✅ (non applicable) | Le dashboard n'utilise aucune image raster (uniquement emojis Unicode et SVG générés par Recharts) → pas de LCP pénalisé par des images non optimisées. |
| Mise en cache HTTP des API | ✅ | `cacheHeaders()` (`lib/api/response.ts`) : `s-maxage` + `stale-while-revalidate` sur tous les endpoints de lecture publique (`/api/companies*`, `/api/market/*`). |
| Requêtes base de données | ✅ | Requêtes groupées via `Promise.all` (`getCompaniesFullDataset`, `app/api/companies/route.ts`) plutôt qu'en série ; `distinct`/`select` ciblés pour limiter les colonnes transférées. |
| Rendu serveur du premier chargement | ✅ | `app/page.tsx` (Server Component) appelle `getCompaniesFullDataset()` **directement**, sans aller-retour HTTP interne (`fetch` vers sa propre API) — élimine une latence réseau superflue au premier rendu. |
| Taille du bundle client (JS) | 🟡 | `First Load JS` de la page `/` ≈ 215 kB (dont Recharts, chargé pour tous les onglets même quand un seul est visible). **Optimisation identifiée mais non appliquée** : découper les onglets "Courbe historique"/"Projection"/"Comparaison" avec `next/dynamic` (`ssr: false`) pour ne charger Recharts qu'à l'ouverture effective de l'onglet — non fait ici pour éviter tout risque de régression visuelle (flash de chargement) sans pouvoir vérifier dans un navigateur réel. |
| Stratégie de rendu (ISR vs dynamique) | 🟡 | `app/page.tsx` est en `force-dynamic` (toujours resservi depuis la base, jamais de cache statique) — correct pour la fraîcheur des données de marché, mais élimine le bénéfice du cache Vercel Edge sur la page HTML elle-même. **Amélioration future** : `export const revalidate = 30` (ISR) au lieu de `force-dynamic`, une fois le volume de trafic réel connu. |
| Web Vitals monitoring | ⬜ | Aucun outil de mesure en production (ex. Vercel Analytics, `web-vitals` + endpoint de collecte). À ajouter avant mise en production réelle pour surveiller LCP/INP/CLS en continu. |
| Compression / minification | ✅ (automatique) | Gérée nativement par Next.js/Vercel (build de production testé avec succès, `next build`). |

---

## 4. RGPD / protection des données personnelles

| Point | État | Détail |
|---|---|---|
| Minimisation des données collectées | ✅ | Seuls email, mot de passe (haché), nom (facultatif) sont demandés à l'inscription — aucune donnée superflue. |
| Base légale du traitement | 🟡 | Implicite (exécution du contrat de service pour un compte utilisateur). **Manquant** : case à cocher explicite d'acceptation des CGU/politique de confidentialité au moment de l'inscription. |
| Information des utilisateurs | ✅ | `app/mentions-legales/page.tsx` (nouvelle page, cf. §5) détaille les données collectées, leur finalité, les cookies utilisés et les droits RGPD. |
| Cookies | ✅ | Un seul cookie, strictement nécessaire (session NextAuth) — pas de bandeau de consentement requis pour un cookie exempté (finalité strictement technique). Documenté dans les mentions légales. |
| Droit d'accès / rectification / effacement | ⬜ | Aucun endpoint self-service (`DELETE /api/account`, export des données personnelles) n'existe encore. **À ajouter avant mise en production réelle avec de vrais utilisateurs** — actuellement, une demande devrait être traitée manuellement par l'éditeur. |
| Chiffrement des données sensibles au repos | 🟡 | Dépend de l'offre PostgreSQL choisie (Supabase/Neon chiffrent par défaut au repos). Le mot de passe applicatif est haché (bcrypt) indépendamment du chiffrement disque. |
| Registre des traitements / DPO | ⬜ | Non applicable à ce stade de prototype ; à formaliser si le volume d'utilisateurs réels devient significatif. |
| Transferts de données hors UEMOA/UE | 🟡 | Dépend de la localisation réelle de l'hébergeur Postgres/Vercel choisie — à documenter une fois l'infrastructure de production figée. |

---

## 5. Disclaimer financier & mentions légales sur l'origine des données

| Point | État | Détail |
|---|---|---|
| Disclaimer déjà présent en footer du dashboard | ✅ conservé tel quel | *"⚠️ Analyse informative uniquement. Les projections ne constituent pas un conseil en investissement."* — **texte non modifié**, conformément à la contrainte non-négociable. |
| Renforcement du disclaimer | ✅ | `app/mentions-legales/page.tsx` — section "Avertissement financier" détaillée (limites des modèles statistiques, absence de prise en compte de l'actualité de l'émetteur, recommandation de consulter un conseiller agréé, référence à la réglementation UEMOA). |
| Mention légale sur l'origine des données | ✅ | Section dédiée "Origine et fiabilité des données" sur la même page : priorité BRVM.org > Sikafinance > Richbourse > manuel, seuil de divergence 2%, non-affiliation aux sources citées. |
| Lien vers cette page depuis le dashboard | ✅ | Ajouté dans le footer, **après** le texte d'origine (jamais modifié ni retiré), avec l'accord explicite de l'utilisateur : `· Mentions légales` (lien discret, couleur `textDim`, souligné). |

---

## 6. Récapitulatif — actions concrètes déjà livrées à l'étape 9

- `next.config.mjs` — en-têtes de sécurité HTTP (`headers()`), CSP de base.
- `middleware.ts` + `lib/security/rate-limit.ts` (+ 4 tests Vitest) — rate limiting par IP sur `/api/**`.
- `app/layout.tsx` + `app/globals.css` — lien d'évitement, landmark `<main>`.
- `components/BrvmDashboardClient.tsx` — rôles ARIA (tabs, listes, boutons), navigation clavier de la liste de sociétés, `scope="col"` sur les tableaux — **aucun changement visuel ni textuel**.
- `app/mentions-legales/page.tsx` — page dédiée (RGPD, disclaimer renforcé, origine des données).
- `app/robots.ts` — `robots.txt` généré (exclut `/api/**` du crawl).

✔ `tsc --noEmit` ✅ · `vitest run` (70/70 tests) ✅ · `next build` ✅ (middleware inclus, 16 routes + `/robots.txt`).

## 7. Actions restantes avant une mise en production réelle

1. Brancher le rate limiting sur Redis/Vercel KV (actuellement en mémoire, non fiable multi-instances).
2. Durcir la CSP (nonces) après validation visuelle du dashboard dans un vrai navigateur.
3. Ajouter un endpoint self-service RGPD (suppression/export de compte).
4. Ajouter une case d'acceptation CGU/politique de confidentialité à l'inscription.
5. Auditer les contrastes de couleur et le focus clavier avec un outil (axe/Lighthouse) sur un déploiement réel.
6. ~~Décider avec l'utilisateur de l'ajout (ou non) d'un lien vers `/mentions-legales` dans le footer du dashboard.~~ ✅ Fait (09/08/2026).
7. Mettre en place un monitoring Core Web Vitals en production.
8. Exécuter `npm audit` régulièrement (CI) et surveiller les avis de sécurité sur `xlsx`/dépendances scraping.
