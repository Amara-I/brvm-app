# Rattrapage additif — cours, rapports, communiqués BRVM/NGX

## Objectif et état réel

Compléter les informations existantes, sans supprimer ni réécrire de cours, rapport ou article. Ce lot prolonge la PR #93, sans merge ni promotion en production.

**Code ≠ données chargées.** Aucun rattrapage réel n'a été appliqué pendant cette intervention. Une simulation locale avec les variables protégées du preview a échoué dès la lecture de la base : serveur PostgreSQL externe inaccessible depuis le sandbox. Aucun secret n'a été affiché ni écrit dans le dépôt. Ce résultat ne prouve pas que la base est indisponible depuis les fonctions Vercel. Les sources ont été examinées via recherche/lecture web, pas via une collecte réseau complète exécutée dans le sandbox.

## Chemin concret pour reconstituer les historiques

1. **BRVM** : réutiliser GetHistos Sikafinance en journalier, une fenêtre de **31 jours maximum** par ticker. Le nouveau job part de 2006-01-01, au lieu de la borne glissante d'un an du job historique existant. Les mois sont des fenêtres de requête, pas des points interpolés. BRVM officiel reste conservé/prioritaire ; aucune ligne canonique existante n'est démotée. Aucune dépendance à la clé du catalogue OuestBourse.
2. **NGX** : réutiliser les PDF officiels `Daily Official List`, puis `Daily Summary`, pour chaque séance de la fenêtre demandée, **sans le seuil de 80 titres** du backfill existant qui laissait des trous sur des titres minoritaires. Appliquer les alias de tickers déjà vérifiés dans le dépôt. Aucun titre inconnu créé/renommé automatiquement.
3. Conserver un curseur en base dans `ingestion_logs` (`ADDITIVE_ENRICHMENT`), par marché/opération/fenêtre/univers de sociétés. Une erreur réseau **ne fait pas avancer** le curseur. Budget maximum 240 s ; reprise sur l'unité non terminée.
4. Documenter les périodes où la source ne répond pas ou n'a pas de données. **Une file de tâches parcourue n'est pas la preuve d'une couverture complète.** Un 404 PDF peut correspondre à une archive absente, pas seulement à un jour férié. Une réponse vide GetHistos n'autorise aucune fabrication de cours. Les dates de cotation ultérieures à 2006 doivent être prises en compte dans l'audit métier.
5. Si les archives publiques s'arrêtent : compléter avec un export officiel/autorisé, après vérification des droits et du format. Les historiques NGX anciens sont proposés commercialement sur demande : aucun achat, contournement d'accès ou droit de redistribution n'est présumé.

## Conservation et conflits

Nouveau chemin d'insertion isolé : `lib/ingestion/additive/`. Il n'appelle pas les upserts de rafraîchissement existants.

- Prix : `createMany(skipDuplicates)` seulement ; les valeurs existantes par (société, date, source) restent identiques.
- Si une date porte déjà des données, toute nouvelle source reste candidate non canonique. Jamais d'`UPDATE`/`DELETE` sur `price_history` dans ce chemin ; canonique nouveau uniquement sur une date entièrement vide.
- Verrou SQL court sur `price_history` pendant lecture/insertion ; aucun réseau sous verrou. Ce verrou peut retarder brièvement d'autres ingestions, mais ne réécrit rien. Les autres jobs existants conservent leur fonctionnement ; il ne s'agit pas d'une immutabilité rétroactive de tous les autres chemins du projet.
- Conflit >2 % : ligne d'audit non résolue dans `data_discrepancies`, détails des sources et des deux valeurs dans le journal du job. L'écart n'est jamais « corrigé » automatiquement. Le schéma historique d'audit comporte trois colonnes BRVM/Sika/Richbourse : pour NGX, le couple de sources est dans `field`, les valeurs complètes dans le journal JSON.
- Documents/articles : insertions dédupliquées seulement. Aucun titre, URL, résumé, lien société, source ou date existant remplacé.
- Article sans date de publication/dépôt connue : pas d'article à date inventée ; le document peut être catalogué avec date N/D.
- Pas de nouveau calcul financier ou de modification des huit sections d'analyse.

## Rapports et informations nouvelles

- BRVM : découvrir les liens de société depuis le répertoire officiel, suivre la pagination publiée des rapports ; collecter aussi les communiqués officiels.
- NGX : réutiliser la liste officielle SharePoint `XFinancial_News`, avec pagination et symboles historiques. Rapports annuels, comptes audités et autres dépôts/avis sont catalogués avec leur titre d'origine. Une URL de catalogue peut être la page du rapport, pas forcément le PDF direct.
- Appariement strict de société : pas de correspondance approximative. Une ligne ONATEL trouvée sur une page SONATEL n'est pas affectée à SONATEL. Les libellés non reconnus sont omis/signalisés plutôt qu'inventés ; l'exhaustivité de cet appariement reste à valider sur toutes les sociétés.
- Le catalogue contient des **liens et métadonnées**, pas une copie intégrale des articles ou un OCR automatiquement validé des comptes. La présence d'un rapport ne prouve pas que les chiffres ont été extraits, contrôlés et intégrés aux analyses.
- `/rapports` : bibliothèque paginée BRVM/NGX, source, exercice connu, date de dépôt/publication et date de collecte distinctes.
- `/api/companies/[ticker]/documents?exchange=BRVM|NGX&page=1` : accès paginé aux rapports d'une société.
- `/actualites?exchange=BRVM|NGX` et `/api/market/news?exchange=BRVM|NGX` : filtres de marché additifs. Sans filtre, toutes les anciennes nouvelles restent visibles ; aucun article historique non étiqueté n'est arbitrairement attribué à un marché.
- Ce sont des publications/communiqués officiels, pas une promesse de couvrir toute la presse de chaque marché.

## Exécution protégée et simulation obligatoire

API : `GET` (cron) ou `POST /api/cron/enrich-history`. **Authorization Bearer uniquement**, secret fourni par l'environnement ; ne jamais mettre le secret dans l'URL.

Paramètres : `exchange=BRVM|NGX`, `kind=history|publications`, `from=2006-01-01`, `to=YYYY-MM-DD` optionnel (aujourd'hui par défaut), `ticker=SNTS` optionnel, `limit=1..10`, `budgetMs=10000..240000`, `cursor=<next>` optionnel. Sans curseur explicite, reprise du dernier journal du même périmètre.

- `apply=0` (défaut) : collecte et comparaison en **lecture seule**, aucune ligne ni journal de reprise écrits. Pour enchaîner plusieurs simulations, repasser `cursor=next`.
- `apply=1` : nécessite `INGESTION_ADDITIVE_ENABLED=true` ; sinon réponse `skipped`. Activer seulement après revue et simulation sur la base autorisée.
- Arrêt par source : `INGESTION_ADDITIVE_BRVM=false` ou `INGESTION_ADDITIVE_NGX=false`.
- En cas d'échec, le curseur reste sur l'unité échouée. Corriger l'accès/source puis relancer ; un saut manuel par curseur doit être documenté comme une lacune, pas un succès.
- `incomplete=false` indique la fin de la file, **pas** que chaque séance/titre a des données. Examiner les statuts `ARCHIVE_ABSENTE`, `SOURCE_SANS_DONNEES`, `ECHEC` et l'audit de couverture.

CLI sur une machine autorisée avec base joignable, variables d'environnement protégées :

```sh
# Sans écriture : une fenêtre de Sonatel pour commencer
npm run history:additive -- --exchange=BRVM --kind=history --ticker=SNTS --from=2020-01-01 --to=2020-01-31 --limit=1
# Catalogue NGX, sans écriture
npm run history:additive -- --exchange=NGX --kind=publications --ticker=MTNN --limit=1
```

Après contrôle, mêmes commandes avec `--apply=1` et flag activé dans l'environnement autorisé. Ne jamais copier les secrets dans le code ou les arguments littéraux.

## Automatisation proposée dans vercel.json (pas activée en production)

Aucun cron existant retiré ou modifié. Quatre créneaux supplémentaires préparés :

- BRVM historique : minutes 05/25/45, maximum 5 fenêtres par invocation.
- NGX historique : minutes 15/35/55, maximum 3 séances par invocation.
- Rapports/communiqués BRVM : minute 10, maximum 2 sociétés par invocation.
- Rapports/communiqués NGX : minute 40, maximum 5 sociétés par invocation.

**Tant que la PR n'est pas mergée et le flag n'est pas activé, aucun de ces rattrapages n'est appliqué à la production.** La prévisualisation ne doit pas être utilisée pour remplir une base de production partagée. Le déploiement/activation nécessite validation explicite ; aucun merge effectué ici. Le premier rattrapage de vingt ans peut nécessiter des milliers d'appels, des jours/semaines de reprise et des archives sous licence : pas de date de fin garantie. Surveiller durée, stockage, quotas et limites des sources.

Les pages de lecture affichent déjà les données cataloguées existantes, sans attendre l'activation du nouveau traitement.

## Sources examinées le 1 novembre 2026

- https://www.brvm.org/fr/rapports-societes-cotees — répertoire officiel d'émetteurs, paginé.
- https://www.brvm.org/fr/rapports-societe-cotes/sonatel — rapports Sonatel ; la liste contient aussi une ligne ONATEL, d'où l'appariement strict.
- https://www.brvm.org/fr/emetteurs/type-annonces/communiques — communiqués datés (ex. 13/10/2026 Sonatel, 23/10/2026 ETI).
- https://www.sikafinance.com/marches/download/BRVMFI — téléchargement historique par périodes de maximum un mois ; le connecteur existant utilise GetHistos. Disponibilité effective à vérifier titre par titre.
- https://ngxgroup.com/exchange/data/data-library/ — archives officielles de séances NGX, utilisées par le parseur existant.
- https://ngxgroup.com/exchange/data/historical-data/ — historique fin de journée depuis 1996 sur demande et payant.
- https://www.mtn.ng/investors/annual-report/ — rapports annuels officiels MTN Nigeria depuis 2019 visibles ; source complémentaire repérée, pas un connecteur supplémentaire déployé.
- https://africanfinancials.com/document/ng-mtn-2015-ab-00/ — rapport abrégé ancien repéré ; pas importé automatiquement, ni confondu avec dix ans de comptes audités complets. Droits de réutilisation à vérifier.

Aucun montant financier tiré de ces pages n'a été inventé ou saisi à la main. Aucune clé payante requise par les nouveaux connecteurs publics ; des restrictions/robots ou archives absentes restent possibles et doivent être respectées.

## Validation

Tests ajoutés : planification mensuelle/jours ouvrés, validation des paramètres, conservation de toutes les lignes existantes, idempotence, canonique unique pour une date vide, conflit sans écrasement, simulation sans écritures, verrou en écriture, pas de date inventée, déduplication des rapports/nouvelles, garde de secret/flag, reprise sans sauter les erreurs, filtrage par marché et API de documents.

Résultat local : 137 suites, 952 tests réussis et 2 ignorés ; TypeScript et build réussis.

Tests source/DB simulés : ils ne remplacent pas un essai source réel depuis Vercel et un contrôle avant/après en PostgreSQL. Résultats finaux, commit de preview et vérification navigateur seront reportés dans la PR. À valider avant toute activation : volume ajouté, dates extrêmes, trous, unicité canonique, absence de modification des anciens enregistrements, qualité/monnaie/périmètre des comptes extraits, droits des sources, coût et temps des jobs.
