# Fiabilisation BRVM + NGX — 1 novembre 2026

## Statut : livraison PARTIELLE, pas une autorisation de production

Ce lot corrige des points d'entrée transverses. Il ne certifie ni une couverture exhaustive des sociétés cotées, ni vingt ans d'historique, ni dix ans de comptes complets. Ne pas fusionner tant que les critères métier ci-dessous ne sont pas vérifiés et approuvés humainement.

## Constat vérifié dans le code de main

La NGX n'est pas seulement un lien : ingestion officielle quotidienne, rattrapage PDF reprisable sur cinq ans, fiches, graphique, screener, indices, dividendes et calculs de valorisation existent déjà. Le catalogue actif réel doit être audité contre les listes officielles ; aucun nombre de sociétés n'est repris comme vérité constante.

L'index de recherche du header, l'export et le résumé API étaient BRVM seulement. La fiche NGX annonçait huit sections mais en affichait neuf et en masquait six sans comptes.

## Changements

- Recherche BRVM/NGX groupée, filtrable, liens de fiches corrects ; index léger mis en cache 60 s, aucune série historique dans le header. Route `/api/search?q=&exchange=NGX`.
- Sélecteur explicite BRVM/NGX dans le header. Préférence locale persistante ; la route explicite prime, aucune redirection automatique d'un lien partagé.
- Cartes BRVM et NGX au même niveau sur l'accueil : indice, variation, effectif de la base, source/date. Capitalisation totale **N/D**, non calculée à partir d'une couverture partielle.
- `/api/companies`, `/api/companies/[ticker]` et `/api/market/summary` : place et devise explicites ; détail/résumé acceptent `exchange=NGX`, défaut BRVM préservé. Le détail expose aussi CA/RE/RN et horodatages de collecte.
- Export : feuille « Données NGX » en NGN, séparée de « Données BRVM » et des projections/classements BRVM existants. Absences ≠ dividende nul. Source et date du dernier cours NGX dans la feuille ; les colonnes annuelles restent des observations de fin d'année, pas un export journalier exhaustif.
- Fiche NGX : huit rubriques fixes, même sans comptes ; analyse graphique conservée À L'INTÉRIEUR de la conclusion. Tableau de performances avec dix exercices révolus visibles (trous N/D), sans injecter ces trous dans les calculs. Pas de modification de la méthodologie des scores.
- `/api/market/coverage?exchange=BRVM|NGX` : inventaire public, lecture seule, dates extrêmes/comptages canoniques et années de comptes manquantes par titre. La présence d'un point ancien **ne prouve pas** la continuité ni la granularité ; ces deux critères restent NON_VERIFIEE. Cet audit n'affirme pas vérifier la duplication SQL ni l'existence HTTP de toutes les fiches.

## Données complétées

**Aucune valeur financière importée, extrapolée ou corrigée en base pendant ce lot.** Aucun secret lu/copier dans le dépôt. Aucune migration, ingestion ou correction de données de production lancée. Les ajouts de colonnes et de lignes N/D sont des changements de présentation, pas de nouvelles données.

## Sources examinées le 1 novembre 2026

- BRVM historique : https://www.brvm.org/fr/donnees-historiques — données disponibles sur demande ; profondeur exacte et droits de redistribution non précisés sur la page.
- BRVM bulletins : https://www.brvm.org/fr/bulletins-officiels-de-la-cote — archives officielles ; existence de la page ≠ récupération exhaustive.
- NGX historique : https://ngxgroup.com/exchange/data/historical-data/ — cours fin de journée jusqu'à 1996 **payants, sur demande** ; redistribution à clarifier.
- NGX bibliothèque : https://ngxgroup.com/exchange/data/data-library/ — listes officielles utilisées par le connecteur existant.
- NGX API : https://marketdataapiv3.ngxgroup.com/portal/Home/Documentation — jeton requis ; l'endpoint interday annonce jusqu'à dix ans, pas vingt.
- Priorité BRVM du pipeline existant : BRVM officiel → Sikafinance → Richbourse (OuestBourse est aussi présent dans l'ordre historique du dépôt ; non modifié silencieusement).

Ces pages ne fournissent pas à elles seules l'intégralité des cours/comptes demandés. Une commande d'archives/licence ou un jeu de fichiers officiel autorisé est nécessaire pour garantir la profondeur manquante. Ne jamais contourner les restrictions d'accès ni acheter de données sans accord.

## Validation et limites

- Référence avant modification : 125 suites, 912 tests réussis, 2 ignorés.
- Tests ajoutés : recherche par place, séparation des routes/devises, export N/D vs zéro ; contrats de routes marché/liste/fiche/recherche/export avec Prisma simulé ; rendu SSR des huit sections avec et sans comptes ; couverture sans inférence abusive.
- Les tests Prisma simulés vérifient les contrats, **pas** l'état réel de PostgreSQL ni les sites sources.
- TypeScript `tsc --noEmit` réussi. Suite complète : 130 suites, 926 tests réussis, 2 ignorés (14 nouveaux tests). Tests ciblés rejoués après ajout de la provenance : 8/8. Build : résultat final dans la PR.
- Prévisualisation : résultats finaux dans la PR, avec commit exact. Aucun merge/promotion.
- LCP, latence API et audit complet a11y non mesurés localement ; un build vert ne les remplace pas.

### Critères de release encore requis

- [ ] Liste officielle exhaustive BRVM/NGX réconciliée, y compris changements de tickers et radiations.
- [ ] Archives autorisées depuis 2006 (ou date de cotation postérieure), granularité explicite et continuité auditée.
- [ ] Dix années de CA/RE/RN, fondamentaux critiques et sources par valeur ; les N/D critiques restent BLOQUANTS pour la validation, pas remplacés par des chiffres.
- [ ] Unicité canonique vérifiée en base, journalisation des écarts >2 % et tests de concurrence des ingestions.
- [ ] Portefeuille multi-devises NGN/XOF/EUR/USD : méthode de conversion datée, source USD et historique FX à définir ; aucune addition de NGN à des XOF. Le portefeuille existant n'est PAS élargi dans ce lot.
- [ ] Unification des scores BRVM/NGX et des filtres screener, après comparaison financière des conventions existantes ; pas de remplacement silencieux des scores BRVM.
- [ ] Structure huit points côté BRVM : non refondue dans ce lot ; la correction des sections concerne la fiche NGX.
- [ ] Compléments du lexique nigérian et validation des outils graphiques NGX (RSI/MACD/Fibonacci/mesure).
- [ ] Vérification HTTP de chaque ticker, tests d'intégration sur vraie base de prévisualisation, non-régression BRVM, LCP et temps API mesurés.
- [ ] Revue humaine explicite avant production.

## Propositions seulement (non implémentées)

| Proposition | Bénéfice | Effort indicatif | Risque |
|---|---|---|---|
| Comparateur multi-marchés et watchlist | Comparaison explicite des devises, suivi rapide | 3–5 jours | Ratios non comparables, biais FX |
| Alertes de dividendes sourcées | Moins d'échéances manquées | 2–4 jours | Dates révisées, consentement notifications |
| ISR ciblé, pagination et chargement différé des graphes | Réduction du poids initial et des appels DB | 2–4 jours | Cache trop ancien, invalidation incomplète |
| Tableau de fraîcheur et écarts par source | Détecter les incidents avant les utilisateurs | 2–3 jours | Faux positifs sur suspensions et jours fériés |
| Export PDF des huit sections | Analyse partageable et datée | 2–4 jours | Pagination, droits de redistribution |
| API publique avec quotas | Réutilisation des données | 5–10 jours | Licences, coûts, abus et sécurité |
| Audit des thèmes clair/sombre existants | Contraste cohérent, pas une seconde bascule | 1–2 jours | Régression de couleurs |

Estimations non contractuelles ; elles supposent des données déjà fiables et autorisées.
