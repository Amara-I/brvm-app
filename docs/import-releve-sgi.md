# Import d’un relevé de titres SGI

Un utilisateur connecté peut déposer, sur la page **Portefeuille**, le relevé de titres (ou relevé de portefeuille) envoyé par sa SGI. L’application propose les lignes reconnues, l’utilisateur les corrige, puis confirme. **Le fichier n’est pas enregistré** : il est lu en mémoire puis oublié.

## Parcours

1. Ouvrir un portefeuille et choisir **Importer un relevé SGI**.
2. Glisser le fichier sur la zone, ou appuyer sur **Choisir un fichier**. PDF, Excel (.xlsx, .xls), CSV, ou image JPEG, PNG, WEBP. 4 Mo maximum (une photo plus lourde est réduite dans le navigateur avant l’envoi, jusqu’à 1 600 px). Un autre format est refusé, y compris s’il est déposé. Les photos HEIC / HEIF sont refusées : les exporter en JPEG ou PNG.
3. Vérifier le tableau : **une position par titre**, avec le type (action, obligation, FCP), la société, la confiance, la quantité, le PRU et la date du premier achat. Décocher ou retirer une ligne. Les obligations et FCP sont marqués **Non suivi** et décochés : le portefeuille ne stocke que des actions cotées (`PortfolioHolding.companyId`). Elles ne sont enregistrées que si une société est choisie à la main.
4. Choisir **Fusionner** (ajoute les quantités et recalcule le PRU moyen) ou **Remplacer** (retire les positions actuelles de ce portefeuille, l’historique des mouvements déjà saisis reste en place).
5. Confirmer. Rien n’est écrit avant cette étape.

Authentification obligatoire. Le relevé n’est parsé que pour le portefeuille du compte connecté.

## Formats lus aujourd’hui

| Mise en page | Exemple de fixture | Ce qui est reconnu |
|---|---|---|
| Tableau à colonnes | `fixtures/sgici-colonnes.txt`, `hudson-colonnes.txt`, `atlantique-ordre.txt`, `variation.txt` | En-tête contenant au moins un code ou un libellé, la quantité, et un montant (PRU, cours ou valorisation). L’ordre des colonnes est libre. |
| Blocs « Libellé : valeur » | `fixtures/bici-blocs.txt` | `Code valeur`, `Désignation`, `Quantité`, `PRU` / `Prix de revient`, `Cours`, `Valorisation`. |
| Lignes libres | `fixtures/edc-lignes.txt` | Une position par ligne, nombres en fin de ligne (`quantité`, `PRU`, `cours`, `valorisation`). |
| CSV / Excel | test dans `sgi-statement.test.ts` | Même logique d’en-têtes, séparateur `;`, `,` ou tabulation. Nombres `1 234,50`, `1.234,50` ou `1234.5`. |
| Historique d’opérations | `fixtures/historique-bruit.txt` | En-tête avec Sens / Date / Qté / Cours moy. Les achats et ventes d’un même titre deviennent **une** position : quantité nette, PRU pondéré (une vente ne change pas le PRU), date du premier achat. Quantité nette nulle → ligne ignorée « position soldée ». |

Noms de colonnes déjà compris : Code, Ticker, Libellé, Désignation, Valeur, Quantité, Qté, PRU, PU, Prix de revient, Cours, Cours moy., Dernier cours, Valorisation, Évaluation, Variation, Sens, Nature, Date d’opération.

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

Une ligne est une **obligation** si le libellé contient OBL, obligation, emprunt, EOS, échéance, ou un taux `6,25 %`. C’est un **FCP** s’il contient FCP, fonds, SICAV ou OPCVM. Ces mots l’emportent sur un rapprochement approximatif avec une action. Elles restent dans l’aperçu, décochées, badge **Non suivi**. Aucune table n’a été ajoutée : une position de portefeuille exige une société cotée.

Le rapprochement avec `companies` se fait par ISIN, ticker BRVM, alias (`lib/portfolio/sgi-statement/aliases.ts`) puis nom approché. Une ligne inconnue reste visible, avec la confiance **Aucune** : elle n’est pas importée tant que l’utilisateur n’a pas choisi la société.

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

## Ajouter une mise en page

Aucun relevé réel n’est versionné (données clients). Pour en prendre un nouveau en charge :

1. Anonymiser le relevé (nom, numéro de compte, adresse) et déposer le texte extrait dans `lib/portfolio/sgi-statement/fixtures/<sgi>.txt`. Ne pas committer le PDF d’origine s’il contient encore des données personnelles.
2. Lancer le parseur sur cette fixture. Si les colonnes utilisent un libellé nouveau (`CMP`, `Valo nette`…), l’ajouter à `HEADER_PHRASES` dans `headers.ts`.
3. Si le courtier écrit le titre autrement que dans `companies.name` (`PALMCI`, `SGBCI`, `BICICI`…), ajouter l’alias dans `aliases.ts`. Un alias de moins de 5 caractères ne s’applique que si le libellé est exactement cet alias, pour éviter les faux positifs (`BOA` seul reste ambigu).
4. Si la structure n’est ni un tableau, ni des blocs `Champ : valeur`, ni une ligne avec les nombres à la fin, ajouter un parseur à côté de `parseColumns` / `parseBlocks` / `parseLoose` dans `parse-statement.ts`, avec un `detect` qui retourne 0 quand le texte n’est pas le sien. Le parseur qui sort le plus de quantités l’emporte ; à égalité, le score de détection départage.
5. Ajouter un cas dans `sgi-statement.test.ts` : quantités, PRU, cours, date d’arrêté, et au moins une ligne volontairement inconnue qui doit rester dans `rows`.

Le point d’entrée fichier est `parseStatementUpload` (`parse-upload.ts`). L’aperçu HTTP est `POST /api/portfolio/:id/import-statement` ; l’écriture, après revue, est `POST /api/portfolio/:id/import-statement/confirm`.
