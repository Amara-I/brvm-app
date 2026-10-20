# Import d’un relevé de titres SGI

Un utilisateur connecté peut déposer, sur la page **Portefeuille**, le relevé de titres (ou relevé de portefeuille) envoyé par sa SGI. L’application propose les lignes reconnues, l’utilisateur les corrige, puis confirme. **Le fichier n’est pas enregistré** : il est lu en mémoire puis oublié.

## Parcours

1. Ouvrir un portefeuille et choisir **Importer un relevé SGI**.
2. Glisser le fichier sur la zone, ou appuyer sur **Choisir un fichier**. PDF, Excel (.xlsx, .xls) et CSV, 4 Mo maximum. Un autre format est refusé, y compris s’il est déposé.
3. Vérifier le tableau : société rapprochée, confiance, quantité, PRU. Décocher une ligne, corriger le titre, la quantité ou le PRU.
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

Noms de colonnes déjà compris : Code, Ticker, Libellé, Désignation, Valeur, Quantité, Qté, PRU, Prix de revient, Cours, Dernier cours, Valorisation, Évaluation, Variation.

Le rapprochement avec `companies` se fait par ISIN, ticker BRVM, alias (`lib/portfolio/sgi-statement/aliases.ts`) puis nom approché. Une ligne inconnue reste visible, avec la confiance **Aucune** : elle n’est pas importée tant que l’utilisateur n’a pas choisi la société.

SGI repérées dans l’en-tête (informatif, la lecture ne dépend pas du nom) : SGI-CI, Hudson & Cie, BICI Bourse, SGI Bénin, Atlantique Finance, EDC, Impaxis, CGF Bourse, Matha Capital, SGI Togo, SGI Mali, Coris Bourse.

## PDF scanné

Seule la couche texte est lue (`unpdf` / PDF.js, sans binaire natif). Un PDF image, ou un PDF dont le texte est trop court pour contenir des positions, est refusé avec un message en français. **L’OCR n’est pas branché** : Tesseract (WASM ou binaire) est trop lourd pour une fonction Vercel Hobby. Suite possible : file d’attente + worker, ou demande à la SGI d’un export Excel/CSV.

## Ajouter une mise en page

Aucun relevé réel n’est versionné (données clients). Pour en prendre un nouveau en charge :

1. Anonymiser le relevé (nom, numéro de compte, adresse) et déposer le texte extrait dans `lib/portfolio/sgi-statement/fixtures/<sgi>.txt`. Ne pas committer le PDF d’origine s’il contient encore des données personnelles.
2. Lancer le parseur sur cette fixture. Si les colonnes utilisent un libellé nouveau (`CMP`, `Valo nette`…), l’ajouter à `HEADER_PHRASES` dans `headers.ts`.
3. Si le courtier écrit le titre autrement que dans `companies.name` (`PALMCI`, `SGBCI`, `BICICI`…), ajouter l’alias dans `aliases.ts`. Un alias de moins de 5 caractères ne s’applique que si le libellé est exactement cet alias, pour éviter les faux positifs (`BOA` seul reste ambigu).
4. Si la structure n’est ni un tableau, ni des blocs `Champ : valeur`, ni une ligne avec les nombres à la fin, ajouter un parseur à côté de `parseColumns` / `parseBlocks` / `parseLoose` dans `parse-statement.ts`, avec un `detect` qui retourne 0 quand le texte n’est pas le sien. Le parseur qui sort le plus de quantités l’emporte ; à égalité, le score de détection départage.
5. Ajouter un cas dans `sgi-statement.test.ts` : quantités, PRU, cours, date d’arrêté, et au moins une ligne volontairement inconnue qui doit rester dans `rows`.

Le point d’entrée fichier est `parseStatementUpload` (`parse-upload.ts`). L’aperçu HTTP est `POST /api/portfolio/:id/import-statement` ; l’écriture, après revue, est `POST /api/portfolio/:id/import-statement/confirm`.
