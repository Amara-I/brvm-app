# Agent financier BRVM/NGX — autorisation de 25 EUR/mois

## État de livraison

Code dans la PR #93, sans merge ni activation de production. Aucun appel IA facturé pendant le développement/tests. L'agent et sa partie IA sont **désactivés par défaut**. Les 25 EUR sont un maximum autorisé, pas un abonnement souscrit ni une obligation de dépenser ce montant.

## Ce que fait cette première version

- Détecte les exercices incomplets parmi les dix exercices révolus (CA, résultat d'exploitation, résultat net canoniques). Une société avec un exercice incomplet est une priorité, pas une preuve qu'aucun document public n'existe.
- Alterne les sociétés BRVM et NGX ; une société et un document au maximum par invocation.
- Recherche des pistes publiques avec Google News RSS, gratuitement, sans réutiliser la clé SerpAPI existante. Ce moteur ne couvre pas tout le Web : absence de résultats ≠ absence de données.
- Option catalogue : récupère les dépôts/rapports des connecteurs officiels déjà présents, ajoute au plus 20 documents/communiqués nouveaux, sans écraser l'existant. Dates manquantes : pas de nouvelle à date inventée.
- Lit un PDF déjà catalogué, uniquement sur les domaines autorisés (BRVM officiel pour BRVM ; NGX officiel/MTN Nigeria pour NGX). Recherche web ≠ droit de télécharger n'importe quel lien : les résultats de recherche restent des pistes à vérifier.
- Respecte robots.txt, refuse les redirections et les URL avec credentials/paramètres ; PDF limité à 8 Mio, texte IA limité à 12 000 caractères pertinents et 6 pages (sur au plus les 6 premières pages contenant des libellés financiers). Scan sans texte : pas d'invention par modèle.
- IA : sortie structurée avec année, champ, valeur **telle qu'imprimée**, devise, unité, périmètre groupe/société, page et citation exacte. Seules les observations d'un exercice manquant/révolu et contenant la valeur citée sur la page fournie sont conservées.
- **Aucun INSERT/UPDATE de cours ou de comptes par l'IA.** Les observations sont stockées dans `research_findings`, catégorie CONTENU, provider `finance-agent-review-v1`, statut NOUVEAU avec `PENDING_HUMAN_REVIEW` dans le JSON. Elles ne constituent ni une recommandation, ni un chiffre canonique.
- Les informations du document sont des données non fiables comme instructions. Aucun outil ni navigation n'est donné au modèle ; les instructions de document ne peuvent approuver un budget ou publier un résultat.
- Les huit sections d'analyse, les données chargées précédemment et les jobs existants restent inchangés.

## Plafond applicatif — 25 EUR maximum de réservations mensuelles

- Limite fixe de **2 500 centimes**, non augmentable via une variable d'environnement.
- Avant chaque appel, réservation persistante dans `ingestion_logs`, source MANUEL, `FINANCE_AGENT_RESERVATION_V1`.
- Verrou transactionnel PostgreSQL partagé pour lecture du solde et insertion : deux jobs ne peuvent réserver le même solde. Arrêt si solde insuffisant ou base inaccessible.
- Le coût réservé est un **majorant conservateur**, pas une lecture de facture : octets UTF-8 du texte + réserve de 16 000 jetons d'encapsulation/schéma/système, maximum 1 800 jetons de sortie, tarifs EUR majorants × marge de sécurité 2, minimum 5 centimes par requête.
- Réservation retenue intégralement même sur timeout, réponse invalide ou crash : jamais de remboursement optimiste qui permettrait de redépenser une requête déjà facturée.
- Modèle et fournisseur uniques configurés, `only` pour interdire les autres fournisseurs, aucun fallback modèle ni outil, `maxRetries: 0` côté SDK.
- Mois civil **UTC**, reset au premier du mois ; pause dans la dernière minute avant changement de mois. Ne pas supprimer/altérer les journaux de réservations du mois courant : leur intégrité fait partie du contrôle budgétaire.
- Une valeur comptable invalide ferme le budget plutôt que de le remettre à zéro.

### Ce plafond n'est PAS à lui seul une garantie de facture de 25 EUR

Les fournisseurs facturent généralement en USD et des taxes/FX peuvent s'ajouter. Le majorant n'est fiable que si le tarif fournisseur, les frais, le change et les modalités de jetons sont vérifiés. Il n'inclut ni l'hébergement Vercel/PostgreSQL existant, ni une licence de données, ni d'autres fonctions IA de l'application. Aucun moteur de recherche payant n'est ajouté dans cette version.

**L'IA refuse donc tout appel si l'enveloppe tarifaire et le plafond fournisseur n'ont pas été vérifiés.** Ne pas passer le flag de vérification à true simplement pour faire fonctionner l'agent.

Configurer un plafond AI Gateway pour le **projet utilisant l'OIDC** (ou pour une **clé dédiée** si l'authentification utilise une clé), au montant USD conservateur correspondant à au plus 25 EUR tout compris et avec marge pour la requête en cours. Les budgets Gateway arrêtent les nouvelles requêtes après le seuil ; ne pas compter sur eux seuls pour une conversion EUR ni une absence de dépassement par une requête en cours. Un budget projet ne couvre que l'OIDC de ses déploiements, pas n'importe quelle clé API. BYOK n'est pas couvert par les budgets Gateway : ne pas activer sans autre limite fournisseur appropriée.

Le plafond projet peut bloquer d'autres usages IA du projet (ex. lecture des relevés SGI). Vérifier les usages avant de le modifier ; privilégier un périmètre dédié à l'agent si nécessaire. Aucune limite d'équipe globale ni clé remplacée automatiquement dans ce lot.

## Configuration avant activation

Variables non secrètes de l'environnement voulu :

| Variable | Effet |
|---|---|
| `FINANCE_AGENT_ENABLED=true` | Autorise recherche gratuite et suivi des lacunes |
| `FINANCE_AGENT_CATALOG_ENABLED=true` | Autorise uniquement les ajouts de documents/communiqués officiels |
| `FINANCE_AGENT_AI_ENABLED=true` | Demande l'extraction IA (encore bloquée si coût non vérifié) |
| `FINANCE_AGENT_MODEL` | Identifiant `créateur/modèle`, pas un modèle virtuel modifiable sans audit |
| `FINANCE_AGENT_PROVIDER` | Un seul fournisseur explicitement autorisé |
| `FINANCE_AGENT_INPUT_EUR_PER_MILLION` | Tarif d'entrée **majorant EUR tout compris**, vérifié |
| `FINANCE_AGENT_OUTPUT_EUR_PER_MILLION` | Tarif de sortie **majorant EUR tout compris**, vérifié |
| `FINANCE_AGENT_PRICE_VALID_UNTIL` | Date ISO d'expiration des tarifs/change, au plus 31 jours ; arrêt à expiration |
| `FINANCE_AGENT_PROVIDER_CAP_VERIFIED=true` | Attestation opérateur : plafond fournisseur/bon périmètre et enveloppe vérifiés |

Authentification : OIDC du déploiement ou clé Gateway protégée existante, selon périmètre vérifié ; jamais de clé dans le code, les URL ou les logs. Le secret de cron reste `CRON_SECRET`, **Bearer uniquement**. Pas d'achat de clé/licence de données.

Le flag de vérification est une attestation opérateur, pas une interrogation automatique de la facture Gateway. Tant qu'aucun modèle/tarif/périmètre n'est choisi et contrôlé, l'activation payante reste bloquée.

## Planification et suivi

- Nouveau cron préparé `15 5 * * *` UTC → `/api/cron/finance-agent`. Aucun ancien cron retiré. Les crons production ne sont pas activés par la seule création d'un preview.
- POST/GET public de déclenchement libre : **non disponible**. GET protégé par Bearer pour le scheduler uniquement.
- `/api/admin/finance-agent?page=1` : session administrateur requise, cache privé no-store. Renvoie enveloppe valide/invalide, réservations EUR, plafond 25 EUR, pistes et propositions paginées.
- Il s'agit d'une file de revue API, pas d'un nouveau tableau de bord graphique ni d'une application automatique des observations. Aucun bouton « approuver = publier des comptes » ajouté. L'opérateur vérifie le PDF, périmètre, exercice, unité, retraitements et cohérence avant tout import additif autorisé séparément.
- Les logs de run indiquent BLOCKED_UNVERIFIED_COST_OR_PROVIDER_CAP, MONTHLY_CAP_REACHED, PENDING_HUMAN_REVIEW ou l'erreur fermée ; aucune erreur ne publie une estimation.

## Vérifications et limites

- Tests sans dépense : désactivation, refus sans tarification/plafond vérifiés, budget au centime et concurrence sérialisée simulée, refus de sources/credentials/redirections, citations exactes, année/devise/périmètre inconnus refusés, échec après réservation sans remboursement, données seulement en propositions, auth cron et absence de cache public.
- Le test de concurrence utilise une transaction sérialisée simulée ; le verrou PostgreSQL doit aussi être vérifié dans un environnement de staging avant une activation payante.
- Une citation exacte ne prouve pas la justesse du périmètre comptable ni l'identité de la société ; validation humaine obligatoire.
- Extraction limitée au texte sélectionnable : OCR, archives non publiques, tableaux trop éloignés et graphes sont hors de cette première version. Aucune promesse d'exhaustivité Internet ou de vingt ans complets.
- Les problèmes d'appariement de rapports BRVM déjà documentés restent à auditer ; pas de réécriture silencieuse du collecteur existant dans ce lot.

## Documentation utilisée

- Sorties structurées : https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- AI SDK et Gateway/OIDC : https://vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk
- Budgets et périmètres : https://vercel.com/docs/ai-gateway/observability-and-spend/budgets
- Restriction fournisseur `only` : https://vercel.com/docs/ai-gateway/models-and-providers/provider-filtering-and-ordering

L'autorisation de 25 EUR/mois ne vaut pas approbation de merge production. Le code, les tests et le preview sont livrés pour revue ; la facture, le modèle, les limites fournisseur et l'exécution permanente ne sont pas déclarés configurés tant que cela n'a pas été vérifié.


## Résultats locaux du lot

- 141 suites, 971 tests réussis, 2 ignorés ; 16 nouveaux tests ciblés de l'agent et du budget.
- `tsc --noEmit` et build local réussis (sans base locale ; avertissements attendus des pages existantes).
- Routes compilées testées sur serveur local, configuration synthétique sans credentials réels : cron sans Bearer → 401 ; API admin sans session → 401 ; cron avec Bearer de test et agent désactivé → 200, `enabled=false`, plafond 25 EUR, aucune dépense ni écriture.
- Le premier essai admin local sans secret NextAuth avait renvoyé 500 (configuration de test incomplète) ; essai rejoué avec secret synthétique puis 401 correct. Aucun secret réel créé ou modifié.
- Pas de test de génération réelle facturée ni de validation de tarifs/facture fournisseur dans ce lot. Statut du preview final et commit dans la PR.
