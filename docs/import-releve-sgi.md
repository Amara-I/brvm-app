# Import d’un relevé de titres SGI

Un utilisateur connecté peut déposer, sur la page **Portefeuille**, le relevé de titres (ou relevé de portefeuille) envoyé par sa SGI. L’application propose les lignes reconnues, l’utilisateur les corrige, puis confirme. **Le fichier n’est pas enregistré** : il est lu en mémoire puis oublié.

## Parcours

1. Ouvrir un portefeuille et choisir **Importer un relevé SGI**.
2. Glisser le fichier sur la zone, ou appuyer sur **Choisir un fichier**. PDF, Excel (.xlsx, .xls), CSV, ou image JPEG, PNG, WEBP. 4 Mo maximum (une photo plus lourde est réduite dans le navigateur avant l’envoi, jusqu’à 1 600 px). Un autre format est refusé, y compris s’il est déposé. Les photos HEIC / HEIF sont refusées : les exporter en JPEG ou PNG.
3. Vérifier le tableau : **une position par titre**, avec le type (action, obligation, FCP), la société ou le nom de l’instrument, la quantité, le PRU et la date du premier achat. Décocher ou retirer une ligne. Les obligations et FCP sont cochées et enregistrées comme telles (nom, ISIN, nominal, coupon, échéance, VL).
4. Choisir **Fusionner** (ajoute les quantités et recalcule le PRU moyen, y compris pour une obligation ou un FCP déjà suivi dans la même unité de prix) ou **Remplacer** (retire les actions, obligations et FCP actuels de ce portefeuille ; l’historique des mouvements d’actions déjà saisis reste en place).
5. Confirmer. Rien n’est écrit avant cette étape.

Authentification obligatoire. Le relevé n’est parsé que pour le portefeuille du compte connecté.

## Modèles

L’import fait toujours quatre choses, dans cet ordre :

1. **Détecter la famille** : mouvements groupés, liste d’opérations à plat, ou liste de positions déjà nettes.
2. **Appliquer le modèle** dont les règles de détection collent. Le premier modèle qui lit quelque chose gagne. L’ordre est `mouvements-titres`, puis `operations`, puis `positions`.
3. **Réconcilier** : quantité nette, PRU pondéré, et pour un grand livre le solde courant comparé au solde d’en-tête.
4. **Expliquer la confiance** de chaque ligne (alias, code, solde confirmé, ou la raison d’une confiance faible).

| Modèle | Famille | Détection | Réconciliation |
|---|---|---|---|
| `mouvements-titres` | mouvements | Colonnes Titre, Date, Libellé, Valeur unitaire, Débit, Crédit, Solde. Lignes groupées par titre. | Solde d’ouverture, crédit = entrée, débit = sortie, PRU pondéré, contrôle du solde. |
| `operations` | opérations | Colonne Sens, ou les mots Achat / Vente, une ligne par opération. | Quantité nette, PRU pondéré, premier achat. Quantité nulle écartée. |
| `positions` | positions | Tableau, blocs « Libellé : valeur », ou une position par ligne. Pas de sens. | La quantité imprimée est gardée telle quelle. |

Les profils sont dans `lib/portfolio/sgi-statement/templates/`. `mouvements-titres` est le modèle de référence : ses règles sont aussi le texte donné au modèle de vision.

## Formats lus aujourd’hui

| Mise en page | Exemple de fixture | Ce qui est reconnu |
|---|---|---|
| Tableau à colonnes | `fixtures/sgici-colonnes.txt`, `hudson-colonnes.txt`, `atlantique-ordre.txt`, `variation.txt` | En-tête contenant au moins un code ou un libellé, la quantité, et un montant (PRU, cours ou valorisation). L’ordre des colonnes est libre. |
| Blocs « Libellé : valeur » | `fixtures/bici-blocs.txt` | `Code valeur`, `Désignation`, `Quantité`, `PRU` / `Prix de revient`, `Cours`, `Valorisation`. |
| Lignes libres | `fixtures/edc-lignes.txt` | Une position par ligne, nombres en fin de ligne (`quantité`, `PRU`, `cours`, `valorisation`). |
| CSV / Excel | test dans `sgi-statement.test.ts` | Même logique d’en-têtes, séparateur `;`, `,` ou tabulation. Nombres `1 234,50`, `1.234,50` ou `1234.5`. |
| Historique d’opérations | `fixtures/historique-bruit.txt` | En-tête avec Sens / Date / Qté / Cours moy. Les achats et ventes d’un même titre deviennent **une** position : quantité nette, PRU pondéré (une vente ne change pas le PRU), date du premier achat. Quantité nette nulle → ligne ignorée « position soldée ». |
| Mouvements de titres | `fixtures/mouvements-titres.txt` | Colonnes Titre, Date, Libellé, Valeur unitaire, Débit, Crédit, Solde. Le titre est sur une ligne de groupe (solde de clôture à droite) ; les lignes suivantes ont le titre vide. « Solde au … » est le solde d’ouverture, pas un achat. Le crédit est une entrée, le débit une sortie. `8 520.000` = 8 520 FCFA. Si le solde calculé ne vaut pas le solde du groupe, la ligne est marquée en confiance faible. Un solde d’en-tête sans mouvements (capture coupée) est repris tel quel, PRU vide. |

Noms de colonnes déjà compris : Code, Ticker, Libellé, Désignation, Valeur, Quantité, Qté, PRU, PU, Prix de revient, Cours, Cours moy., Dernier cours, Valorisation, Évaluation, Variation, Sens, Nature, Date d’opération, et pour un relevé de mouvements : Titre, Valeur unitaire, Débit, Crédit, Solde.

Dans un relevé de mouvements, le **crédit** est une entrée de titres (acquisition, souscription, attribution) et le **débit** une sortie (cession, vente, rachat, transfert sortant). « Solde au … » est le solde d’ouverture. Le nombre `8 520.000` vaut 8 520. Le solde calculé est comparé au solde du groupe : s’il diffère, la ligne reste visible avec une confiance faible. Une capture coupée (solde d’en-tête, sans les mouvements) reprend cette quantité et laisse le PRU vide. Une position revenue à zéro est ignorée ; le résultat réalisé est indiqué quand les prix sont connus. Un groupe qui continue sur la page suivante garde son titre. Les noms SGI (`CIE COTE DIVOIRE`, `BOA-BURKINA FASO`, `FILTISAC COTE D'IVOIRE`…) sont rapprochés des 47 cotations.

## Ce qui est ignoré

Dès qu’un en-tête de tableau est reconnu et que des lignes portent un sens (Achat / Vente), tout le reste est écarté et compté. Le détail s’ouvre sous l’aperçu :

| Motif | Exemples |
|---|---|
| En-tête de colonnes | la ligne `Date · Libellé · Qté · Sens` |
| Adresse ou identité | Client, adresse, téléphone, e-mail, IBAN |
| Titre de section | « Historique des transactions », « Arrêté au … » |
| Espèces | espèces, liquidités, disponibilités |
| Frais | courtage, commission, TVA, droits de garde |
| Total | total, sous-total, net à payer |
| Page | `Page 1 / 2` |
| Mention légale | disclaimer, « ne constitue pas un conseil » |
| Pas une ligne de titre | ligne sans libellé ni quantité |
| Position soldée | achats − ventes = 0 |
| Déjà couverte | une ligne de position sur un titre qui a déjà des opérations |

Les lignes vides ne sont pas comptées. Un relevé de **positions** (pas de colonne Sens, pas de mot Achat/Vente) garde l’ancien lecteur : les quantités sont prises telles quelles.

## Obligations et FCP

Une ligne est une **obligation** si le libellé contient OBL, obligation, emprunt, EOS, échéance, ou un taux `6,25 %`. C’est un **FCP** s’il contient FCP, fonds, SICAV ou OPCVM. Ces mots l’emportent sur un rapprochement approximatif avec une action.

Elles sont **cochées** et enregistrées dans `portfolio_other_holdings` (migration `20261020190000_portfolio_other_holdings`). Les actions restent dans `portfolio_holdings`. Plusieurs achats et ventes du même instrument sont agrégés comme pour une action : quantité nette, PRU pondéré, date du premier achat.

Dans l’aperçu on peut corriger le nom, l’ISIN, la quantité, le prix, la date, et selon le type : nominal, coupon, échéance, unité du prix (FCFA ou % du nominal), société de gestion, dernière VL. Le prix du relevé est enregistré en **FCFA** tant que l’utilisateur ne choisit pas « % du nominal ». Un taux `6,25 %` dans le libellé remplit le coupon. Une année seule (`2028`) ne remplit pas l’échéance : il faut une date complète. Rien n’est inventé.

Valorisation dans le portefeuille : dernier prix ou dernière VL saisis s’ils existent, sinon prix ou VL d’achat. Un prix en % du nominal sans nominal affiché donne **N/D**. Le coupon couru n’apparaît que si le taux, le nominal et la date d’achat sont connus (base 365 jours depuis l’achat, plafonné à l’échéance). Il n’est pas ajouté à la valeur. Pas d’historique de cours pour ces lignes.

Le rapprochement des **actions** avec `companies` se fait par ISIN, ticker BRVM, alias (`lib/portfolio/sgi-statement/aliases.ts`) puis nom approché. Une action inconnue reste visible, avec la confiance **Aucune** : elle n’est pas importée tant que l’utilisateur n’a pas choisi la société.

SGI repérées dans l’en-tête (informatif, la lecture ne dépend pas du nom) : SGI-CI, Hudson & Cie, BICI Bourse, SGI Bénin, Atlantique Finance, EDC, Impaxis, CGF Bourse, Matha Capital, SGI Togo, SGI Mali, Coris Bourse.

## Photos, captures et PDF scannés

| Cas | Sans clé | Avec clé |
|---|---|---|
| JPEG, PNG, WEBP | OCR `tesseract.js` (français), puis le même parseur que le texte | Modèle de vision, sortie structurée, puis le parseur (les totaux que le modèle recopierait sont ignorés) |
| PDF avec texte | Couche texte (`unpdf`), pas d’appel réseau | Idem, la couche texte suffit |
| PDF image | Refus en français : déposer une photo JPEG/PNG/WEBP | Le PDF est envoyé au modèle de vision |
| HEIC / HEIF | Refus : exporter en JPEG ou PNG | Idem (pas de décodeur HEIC) |

La limite reste **4 Mo** (sous le plafond de corps des fonctions Vercel, 4,5 Mo). Le navigateur réduit les photos à 1 600 px, JPEG qualité 0,82, avant l’envoi. `maxDuration` de la route d’aperçu : 60 s.

### Variables d’environnement

| Variable | Rôle | Coût |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Clé [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). Si elle est absente, `VERCEL_OIDC_TOKEN` (injecté sur Vercel quand le projet est lié) suffit aussi. Sans aucune des deux, aucune requête n’est envoyée. | Une requête par image ou PDF image. Modèle par défaut `google/gemini-2.5-flash` (vision, classe « flash ») : en pratique bien moins de 0,01 USD par page, facturé à l’équipe Vercel. Pas d’appel si la clé manque. |
| `SGI_STATEMENT_VISION_MODEL` | Identifiant Gateway du modèle. Défaut `google/gemini-2.5-flash`. Choisir un modèle **vision** (pas un modèle de génération d’images). | Selon le tarif du modèle choisi. |

L’OCR de repli ne facture rien. Au premier appel d’une instance, `tesseract.js` télécharge les données `fra` (quelques Mo, mis en cache dans `/tmp`). Compter plusieurs secondes : sur un démarrage à froid Vercel Hobby, rester sous les 60 s. Si l’OCR échoue, le message est « Lecture du fichier impossible ».

## Ajouter un modèle

Aucun relevé réel n’est versionné (données clients). Un nouveau courtier qui tient dans un modèle existant ne demande pas un nouveau fichier : un alias ou un libellé de colonne suffit.

1. Anonymiser le relevé (nom, numéro de compte, adresse) et déposer le texte extrait dans `lib/portfolio/sgi-statement/fixtures/<sgi>.txt`. Ne pas committer le PDF d’origine s’il contient encore des données personnelles.
2. Si c’est encore un tableau de positions et que seule une colonne a un nom nouveau (`CMP`, `Valo nette`…), l’ajouter à `HEADER_PHRASES` dans `headers.ts`. Le modèle `positions` la prendra.
3. Si le courtier écrit le titre autrement que dans `companies.name` (`PALMCI`, `SGBCI`, `BICICI`…), ajouter l’alias dans `aliases.ts`. Un alias de moins de 5 caractères ne s’applique que si le libellé est exactement cet alias, pour éviter les faux positifs (`BOA` seul reste ambigu).
4. Si la structure est vraiment nouvelle, ajouter un profil dans `lib/portfolio/sgi-statement/templates/<nom>.ts` sur le modèle de `mouvements-titres.ts` : `id`, `family` (`mouvements`, `operations` ou `positions`), `columns`, et `rules` en français. Ces règles sont recopiées dans le prompt de vision (`visionSystemPrompt`) : décrire ce qu’il faut extraire, pas le calcul du PRU.
5. Brancher le profil dans `parseStatementText` (`parse-statement.ts`) et, si le fichier est un Excel, dans `parseStatementMatrix`. Le `run` détecte (retourner `null` si ce n’est pas lui) puis réconcilie. `firstTemplate` essaie les familles dans l’ordre mouvements, opérations, positions : placer le nouveau modèle dans sa famille.
6. La réconciliation doit produire les mêmes lignes que les autres modèles (`quantity`, `avgBuyPrice`, `tradeDate`, `warnings`). `finalizeStatement` ajoute la phrase de confiance. Ne pas recalculer le PRU une seconde fois dans l’aperçu.
7. Ajouter un cas dans `sgi-statement.test.ts` : quantités, PRU, date du premier achat, confiance, et la phrase qui explique une ligne faible. Pour la vision, valider un JSON avec `parseVisionDocument` / `applyVisionDocument` sans appeler de modèle.

Le point d’entrée fichier est `parseStatementUpload` (`parse-upload.ts`). L’aperçu HTTP est `POST /api/portfolio/:id/import-statement` ; l’écriture, après revue, est `POST /api/portfolio/:id/import-statement/confirm`.

Une photo passe par le modèle de vision quand une clé est configurée. Le JSON (`template`, `lignes` ou `rows`) est validé avec Zod. Un relevé `mouvements-titres` est réconcilié par `reconcileMouvementLedger`, le même code que le PDF et l’Excel. Les nombres peuvent arriver en texte (`8 520.000`) : ils sont relus comme sur un relevé papier.
