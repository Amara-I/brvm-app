import type { EducationTerm } from "./catalog";

const BRVM = "https://www.brvm.org";
const BRVM_INDICES = "https://www.brvm.org/fr/indices";
const BRVM_COTE = "https://www.brvm.org/fr/cours";

const SOURCES = [
  { title: "BRVM — site officiel", url: BRVM },
  { title: "BRVM — Indices (Composite, BRVM-30, Total Return)", url: BRVM_INDICES },
  { title: "BRVM — Cours et cote", url: BRVM_COTE },
];

const RELATED_COMMON = [
  "portefeuille",
  "gestion-du-risque",
  "taille-de-position",
  "liquidite",
  "rendement-du-dividende",
];

/**
 * Thème « Types de portefeuille » — contenu bible produit (document FR)
 * développé en fiches pédagogiques. Aucune règle BRVM inventée hors du
 * document et des disclaimers déjà présents dans l’app.
 */
export const PORTFOLIO_TYPE_EDUCATION_TERMS: EducationTerm[] = [
  {
    slug: "cadre-quatre-portefeuilles-brvm",
    title: "Cadre des quatre portefeuilles BRVM",
    level: "debutant",
    themeSlug: "types-de-portefeuille",
    sortOrder: 1,
    definition:
      "Quatre cadres pédagogiques pour organiser un portefeuille à la BRVM : Croissance, Rente, Trading et Croissance Max. L’objectif n’est pas la performance maximale à n’importe quel prix, mais la meilleure croissance possible par rapport au risque, aux frais, au temps disponible et à la liquidité.",
    details: `## À quoi sert ce cadre

L’objectif n’est **pas** de rechercher la performance maximale à n’importe quel prix, mais d’obtenir la **meilleure croissance possible par rapport au risque, aux frais, au temps disponible et à la liquidité**.

Les quatre types ne sont pas des « produits » vendus par la BRVM. Ce sont des **manières d’organiser vos décisions** : horizon, moteur de rendement (plus-value, revenus, ou mouvements de cours), et discipline de sortie. Aucune allocation ne garantit un rendement. Les pourcentages proposés dans ces fiches sont des **modèles pédagogiques** à adapter à votre situation, à votre capital, à votre horizon et à votre capacité à supporter les pertes.

## Comment on opère à la BRVM

À la BRVM, les opérations sur les titres cotés passent par une **SGI**, avec un **compte-titres** et un **compte espèces**. Le marché fonctionne **au comptant** : il faut disposer des liquidités avant un achat et des titres avant une vente. Les frais doivent donc être intégrés dans toute stratégie, particulièrement dans le trading.

L’avis d’opéré (document de votre intermédiaire) présente notamment le cours exécuté, les frais de courtage, les commissions liées à la BRVM et au Dépositaire Central / Banque de Règlement, ainsi que les taxes et le montant net de la transaction.

## Les quatre types en une phrase

1. **[Croissance](/education/types-de-portefeuille/portefeuille-croissance)** — valorisation du capital sur ≥ 5 ans ; le dividende est secondaire.
2. **[Rente](/education/types-de-portefeuille/portefeuille-rente)** — revenus réguliers (dividendes, coupons, liquidités) et stabilité.
3. **[Trading](/education/types-de-portefeuille/portefeuille-trading)** — variations de cours à court ou moyen terme, avec règles strictes, frais et liquidité.
4. **[Croissance Max](/education/types-de-portefeuille/portefeuille-croissance-max)** — mélange **organisé** des trois poches + cash, sans confondre les règles.

## Règles communes aux quatre portefeuilles

### Diversification raisonnable

La diversification doit porter sur :

- plusieurs sociétés ;
- plusieurs secteurs ;
- plusieurs pays de l’UEMOA lorsque cela est pertinent ;
- plusieurs types de revenus ;
- plusieurs échéances pour les obligations.

Une diversification **excessive** rend le portefeuille difficile à suivre. Une **dizaine à une quinzaine de lignes** bien étudiées peut être plus efficace que plusieurs dizaines de positions mal suivies.

### Ne jamais investir l’argent nécessaire à court terme

La BRVM recommande notamment d’investir une épargne dont l’investisseur n’a pas besoin au quotidien, et de diversifier **sans se disperser**.

### Quatre questions avant chaque achat

Évitez l’achat sur recommandation seule. Avant chaque achat, il faut pouvoir répondre :

1. **Pourquoi** acheter ce titre ?
2. **Quel est le scénario** attendu ?
3. **Quel risque** peut invalider ce scénario ?
4. **Dans quelles conditions** vais-je vendre ?

### Journal de portefeuille

Pour chaque opération, conservez : date, titre, quantité, prix, frais, stratégie utilisée, objectif, niveau de risque, résultat, erreur éventuelle. Ce journal est **particulièrement important** pour le portefeuille Trading. Reliez-le à la [taille de position](/education/taille-position/taille-de-position) et à la [gestion du risque](/education/risques/gestion-du-risque).

## Tableau de synthèse

| Portefeuille | Objectif principal | Horizon | Risque | Méthode |
|---|---|---|---|---|
| Croissance | Augmenter la valeur du capital | Long terme | Moyen à élevé | Analyse fondamentale |
| Rente | Générer des revenus réguliers | Moyen / long terme | Faible à moyen | Dividendes, obligations, stabilité |
| Trading | Profiter des mouvements de cours | Court / moyen terme | Élevé | Règles d’entrée, sortie et gestion du risque |
| Croissance Max | Optimiser la croissance globale | Tous horizons | Moyen à élevé | Combinaison organisée des trois poches |

## Ce que OuestBourse ne fait pas

Choisir un type sur [Mon profil](/profil) **n’invente aucun score** et ne modifie pas le calcul du signal. Cela oriente les rappels pédagogiques (Analyses, Simulations) et les liens vers ces fiches. Les exemples en FCFA sont illustratifs.`,
    example:
      "Vous disposez de 10 000 000 FCFA que vous n’utiliserez pas avant plusieurs années. Un cadre Croissance (ou Croissance Max prudent) est cohérent. Si la même somme doit produire un revenu mensuel, le cadre Rente est plus adapté. Si une fraction seulement (par exemple 1 000 000 FCFA) est du capital « de jeu » avec règles écrites, elle peut aller dans une poche Trading — jamais l’épargne de précaution.",
    synonyms: [
      "Types de portefeuille",
      "Cadre BRVM",
      "Croissance Rente Trading",
      "Allocation pédagogique",
    ],
    resourceUrl: BRVM,
    tip: "Le type de portefeuille décrit votre méthode, pas un palmarès de titres. Sans les quatre questions et le journal, même le « bon » cadre reste de l’improvisation.",
    source: "guide",
    ctaHref: "/profil",
    ctaLabel: "Choisir mon type sur Mon profil",
    relatedSlugs: [
      "portefeuille-croissance",
      "portefeuille-rente",
      "portefeuille-trading",
      "portefeuille-croissance-max",
      "croissance-max-structure-reequilibrage",
      ...RELATED_COMMON,
    ],
    sources: SOURCES,
  },
  {
    slug: "portefeuille-croissance",
    title: "Portefeuille Croissance",
    level: "debutant",
    themeSlug: "types-de-portefeuille",
    sortOrder: 2,
    definition:
      "Portefeuille investi surtout dans des sociétés capables d’augmenter durablement chiffre d’affaires, bénéfices, marges, part de marché et cash. Objectif : valorisation du capital sur au moins cinq ans. Le dividende est secondaire.",
    details: `## Définition

Le portefeuille Croissance investit principalement dans des sociétés capables d’augmenter **durablement** :

- leur chiffre d’affaires ;
- leurs bénéfices ;
- leurs marges ;
- leur part de marché ;
- leur capacité à générer des flux de trésorerie.

L’objectif principal est la **valorisation du capital sur le long terme**, généralement sur une période d’**au moins cinq ans**.

Le dividende est **secondaire** : une entreprise de croissance peut distribuer peu de dividendes si elle réinvestit efficacement ses bénéfices.

## Profil recherché

Ce portefeuille recherche des entreprises :

- en progression régulière ;
- bien positionnées dans leur secteur ;
- capables de financer leur développement ;
- dirigées de manière crédible ;
- présentant un potentiel de croissance **supérieur à la moyenne du marché**.

La BRVM distingue notamment le **compartiment Croissance**, destiné aux PME et aux entreprises à fort potentiel. **Cette classification officielle ne suffit pas à elle seule** pour sélectionner un titre : elle doit être complétée par une analyse financière.

## Comment le réaliser

### Étape 1 — Liste de sélection

Pour chaque société, posez une question par critère (donnée manquante → **N/D**, jamais un chiffre inventé) :

| Critère | Question à poser |
|---|---|
| Chiffre d’affaires | Progresse-t-il régulièrement ? |
| Résultat net | Les bénéfices augmentent-ils ? |
| Marge | L’entreprise devient-elle plus rentable ? |
| Dette | La dette est-elle maîtrisée ? |
| Trésorerie | L’activité génère-t-elle réellement du cash ? |
| Secteur | Le secteur a-t-il encore un potentiel ? |
| Gouvernance | Les informations financières sont-elles régulières et fiables ? |
| Valorisation | Le cours n’intègre-t-il pas déjà toute la croissance attendue ? |

Sur OuestBourse, croisez la [fiche société](/societes-cotees), le [score fondamental](/education/fondamentale/score-fondamental) et le [PER](/education/valorisation/per-price-earnings-ratio) — sans traiter le signal comme un ordre.

### Étape 2 — Ne pas confondre croissance et hausse du cours

Une action dont le cours augmente rapidement **n’est pas nécessairement** une action de croissance. Il faut vérifier que la hausse repose sur :

- une progression des bénéfices ;
- une amélioration des perspectives ;
- une situation financière solide ;
- une demande durable pour les produits ou services.

### Étape 3 — Acheter progressivement

Une méthode prudente consiste à investir **par tranches** :

- **30 %** de la position initiale ;
- **30 %** après confirmation des résultats ou du scénario ;
- **40 %** progressivement si les fondamentaux restent favorables.

Cela réduit le risque d’acheter tout le capital au mauvais moment.

## Allocation indicative

Exemple pédagogique pour un portefeuille Croissance :

| Composante | Allocation |
|---|---|
| Actions de croissance principales | 60 % |
| Actions de croissance secondaires | 20 % |
| Actions défensives de qualité | 10 % |
| Liquidités | 10 % |

Évitez qu’une seule société représente une part excessive. Une **limite indicative** : **10 % à 15 % par ligne**, selon la taille du portefeuille et le niveau de conviction. Rappel : une dizaine à une quinzaine de lignes bien suivies vaut mieux qu’une collection dispersée.

## Règles de sortie

Vendre ou réduire une position lorsque :

- les bénéfices se dégradent **durablement** ;
- la dette devient excessive ;
- la **thèse d’investissement** n’est plus valide ;
- la gouvernance devient préoccupante ;
- le cours devient excessivement valorisé ;
- une **meilleure opportunité** présente un rapport rendement-risque supérieur.

Il ne faut **pas** vendre uniquement parce que le cours a baissé. La vraie question : **les fondamentaux ont-ils changé ?**

## Erreurs fréquentes

- Acheter un titre du compartiment Croissance **sans** lire les comptes.
- Confondre un rallye de cours avec une croissance des bénéfices.
- Tout investir le même jour (pas de tranches).
- Transformer une erreur de timing en « je conserve pour toujours » **sans** revalider la thèse.
- Ignorer la [liquidité](/education/risques/liquidite) : même à 5 ans, il faudra un jour vendre.

## Exemple chiffré (illustratif)

Capital Croissance : **5 000 000 FCFA**.

- Liquidités 10 % = 500 000 FCFA.
- Défensives 10 % = 500 000 FCFA.
- Secondaires 20 % = 1 000 000 FCFA.
- Principales 60 % = 3 000 000 FCFA.

Si vous limitez une ligne à 12 % du portefeuille : plafond ≈ **600 000 FCFA** par titre. Pour une action à 12 000 FCFA, cela fait **50 titres** au plus sur cette ligne — avant même d’appliquer les tranches 30 / 30 / 40.

Première tranche (30 % de la ligne) : 0,30 × 600 000 = **180 000 FCFA** → 15 titres à 12 000 FCFA. Le reste attend la confirmation des résultats.`,
    example:
      "Capital 5 000 000 FCFA, plafond 12 % par ligne = 600 000 FCFA. Titre à 12 000 FCFA → 50 titres max. Première tranche 30 % = 15 titres (180 000 FCFA). Ce n’est pas une recommandation d’achat.",
    synonyms: [
      "Portefeuille de croissance",
      "Capital appreciation",
      "Long terme actions",
      "Compartiment croissance",
    ],
    resourceUrl: BRVM,
    tip: "Cinq ans minimum, fondamentaux d’abord, cours ensuite. Le compartiment officiel « Croissance » est un indice, pas un tampon d’achat.",
    source: "guide",
    ctaHref: "/profil",
    ctaLabel: "Enregistrer le cadre Croissance",
    relatedSlugs: [
      "cadre-quatre-portefeuilles-brvm",
      "portefeuille-rente",
      "portefeuille-trading",
      "portefeuille-croissance-max",
      "chiffre-d-affaires",
      "per-price-earnings-ratio",
      "score-fondamental",
      "horizons-c-m-l",
      "gestion-du-risque",
    ],
    sources: SOURCES,
  },
  {
    slug: "portefeuille-rente",
    title: "Portefeuille Rente",
    level: "debutant",
    themeSlug: "types-de-portefeuille",
    sortOrder: 3,
    definition:
      "Portefeuille dont l’objectif prioritaire est un revenu régulier via dividendes d’actions, coupons d’obligations et, éventuellement, produits de trésorerie. Stabilité et durabilité des revenus plutôt que plus-value rapide.",
    details: `## Définition

Le portefeuille Rente vise à générer des **revenus réguliers** grâce :

- aux **dividendes** des actions ;
- aux **coupons** des obligations ;
- éventuellement aux produits de trésorerie ou OPCVM adaptés.

L’objectif prioritaire n’est **pas** la plus-value rapide, mais la **stabilité et la durabilité** des revenus.

## À qui cela correspond

Ce portefeuille convient davantage à une personne qui :

- souhaite percevoir des revenus réguliers ;
- accepte une croissance plus **modérée** du capital ;
- investit avec un **horizon long** ;
- veut limiter les opérations fréquentes ;
- préfère la **visibilité** au potentiel spéculatif.

## Comment le réaliser

### Étape 1 — Qualité du dividende

Ne retenez pas uniquement les actions offrant le **rendement le plus élevé**. Vérifiez :

- la **régularité** des dividendes sur plusieurs années ;
- le **taux de distribution** ;
- la **progression du bénéfice** ;
- la capacité à générer du **cash** ;
- le niveau d’**endettement** ;
- la **stabilité du secteur**.

Un dividende élevé peut être **exceptionnel et non récurrent**. Il peut également refléter un cours **fortement déprécié**.

Sur OuestBourse, le [rendement du dividende](/education/rendement/rendement-du-dividende) affiché n’est pas une promesse de paiement futur.

### Étape 2 — Diversifier les sources de revenus

Un portefeuille de rente ne devrait pas dépendre :

- d’une seule entreprise ;
- d’un seul secteur ;
- d’une seule échéance obligataire ;
- d’un seul pays ou risque économique.

La BRVM comporte un **marché actions** et un **marché obligataire**. Les obligations peuvent compléter les actions à dividendes, mais elles doivent également être étudiées selon l’**émetteur**, la **maturité**, le **coupon** et le **risque de remboursement**.

### Étape 3 — Réinvestir les revenus (phase de constitution)

Pendant la phase de constitution du capital, les dividendes et coupons peuvent être réinvestis dans :

- les lignes **sous-pondérées** ;
- les actions de qualité temporairement moins chères ;
- les obligations ;
- la trésorerie en attente d’opportunités.

À la retraite (besoin de revenu), une part plus importante peut rester en cash ou être effectivement consommée — c’est un choix personnel, pas une règle de place.

## Allocation indicative

| Composante | Allocation |
|---|---|
| Actions à dividendes durables | 45 % |
| Obligations | 35 % |
| Actions défensives | 10 % |
| Liquidités | 10 % |

Pour une personne déjà à la retraite ou ayant besoin d’un revenu stable, la **part obligataire** peut être plus importante. Pour une personne encore en phase d’accumulation, la **part actions** peut être renforcée.

## Deux rendements à ne pas confondre

Le **rendement courant** du portefeuille :

$$
\\text{Rendement courant} = \\frac{\\text{Dividendes annuels} + \\text{Coupons annuels}}{\\text{Valeur actuelle du portefeuille}}
$$

Le **rendement total** :

$$
\\text{Rendement total} = \\frac{\\text{Revenus encaissés} + \\text{Plus-value ou moins-value}}{\\text{Capital investi}}
$$

Un portefeuille qui verse **8 %** de revenus mais **perd 15 %** en capital n’est pas nécessairement performant.

## Exemple chiffré (illustratif)

Portefeuille : **8 000 000 FCFA**.

- Actions à dividendes 45 % = 3 600 000 FCFA.
- Obligations 35 % = 2 800 000 FCFA.
- Défensives 10 % = 800 000 FCFA.
- Liquidités 10 % = 800 000 FCFA.

Dividendes encaissés sur 12 mois : 216 000 FCFA. Coupons : 140 000 FCFA. Revenus = **356 000 FCFA**.

Rendement courant = 356 000 / 8 000 000 = **4,45 %**.

Si, dans le même temps, la valeur de marché passe à 7 400 000 FCFA (moins-value latente −600 000), le rendement total sur l’année est (356 000 − 600 000) / 8 000 000 = **−3,05 %**. Les 4,45 % de « rente » ne compensent pas la baisse de capital.

## Erreurs fréquentes

- Choisir le **plus gros yield** sans regarder la régularité ni le cash.
- Concentrer la rente sur **un** titre « qui a toujours payé ».
- Oublier les obligations (émetteur, maturité, remboursement).
- Confondre rendement courant et performance réelle.
- Dépenser toute la rente pendant la phase de constitution, puis s’étonner que le capital n’ait pas grandi.`,
    example:
      "Portefeuille 8 000 000 FCFA, revenus 356 000 FCFA → rendement courant 4,45 %. Si le capital recule de 600 000 FCFA, le rendement total est négatif (−3,05 %). Les chiffres sont illustratifs.",
    synonyms: [
      "Portefeuille de revenus",
      "Dividendes et coupons",
      "Income portfolio",
      "Rendement courant",
    ],
    resourceUrl: BRVM,
    tip: "Un yield élevé n’est pas une rente. Mesurez toujours le rendement total, et diversifiez émetteurs, secteurs et échéances.",
    source: "guide",
    ctaHref: "/profil",
    ctaLabel: "Enregistrer le cadre Rente",
    relatedSlugs: [
      "cadre-quatre-portefeuilles-brvm",
      "portefeuille-croissance",
      "dividende",
      "rendement-du-dividende",
      "sante-financiere",
      "gestion-du-risque",
    ],
    sources: SOURCES,
  },
  {
    slug: "portefeuille-trading",
    title: "Portefeuille Trading",
    level: "intermediaire",
    themeSlug: "types-de-portefeuille",
    sortOrder: 4,
    definition:
      "Portefeuille qui cherche à profiter des variations de prix à court ou moyen terme (tendances, volumes, supports, annonces, liquidité). Activité à risque élevé : règles écrites, frais et liquidité BRVM d’abord.",
    details: `## Définition

Le portefeuille Trading cherche à profiter des **variations de prix à court ou moyen terme**.

Il ne repose pas principalement sur les dividendes ou la valeur intrinsèque de l’entreprise, mais sur :

- les **tendances** de cours ;
- les **volumes** ;
- les niveaux de **support et de résistance** ;
- les **annonces** financières ;
- les **mouvements sectoriels** ;
- la **liquidité** du titre.

Le trading doit être considéré comme une **activité à risque élevé**.

## Liquidité BRVM — contrainte réelle

À la BRVM, la liquidité de certaines valeurs peut être limitée : un investisseur peut **ne pas trouver rapidement une contrepartie** au prix souhaité. Il faut donc privilégier les titres **suffisamment échangés** et consulter les **bulletins officiels de la cote**.

La BRVM publie notamment le **BRVM-30**, qui regroupe les valeurs les plus échangées sur un trimestre. Ce n’est pas une liste d’achats : c’est un **repère de négociabilité**.

## Comment le réaliser correctement

### 1. Définir un horizon (et s’y tenir)

Choisissez une méthode précise :

- **court terme** : quelques jours à quelques semaines ;
- **swing trading** : quelques semaines à quelques mois ;
- **position trading** : plusieurs mois.

Évitez de **changer de méthode après chaque perte**.

### 2. Utiliser uniquement des règles écrites

Avant chaque opération, définir :

- le **prix d’entrée** ;
- la **raison** de l’achat ;
- le niveau d’**invalidation** ;
- l’**objectif** de gain ;
- la **durée maximale** de détention ;
- la **taille** de la position.

Exemple du guide : achat à **5 000 FCFA**, scénario invalidé sous **4 600 FCFA**, objectif initial à **5 800 FCFA**, risque maximal égal à **1 %** du portefeuille.

### 3. Limiter le risque par opération

Une règle prudente : ne pas risquer plus de **0,5 % à 1 %** du capital **total** par opération.

Taille de la position :

$$
\\text{Taille de position} = \\frac{\\text{Capital} \\times \\text{Risque maximal}}{\\text{Prix d’entrée} - \\text{Prix d’invalidation}}
$$

Exemple :

- capital : **10 000 000 FCFA** ;
- risque maximal : 1 % = **100 000 FCFA** ;
- achat : **5 000 FCFA** ;
- invalidation : **4 500 FCFA** ;
- risque par action : **500 FCFA**.

$$
\\text{Nombre maximal d’actions} = \\frac{100000}{500} = 200 \\text{ actions}
$$

Cette méthode contrôle le risque **indépendamment du prix du titre**. Calculette OuestBourse : [taille de position](/outils/taille-position). À la BRVM, le stop est en général une **règle personnelle** (alerte), pas un ordre automatique — voir [stop loss](/education/taille-position/stop-loss-brvm).

### 4. Intégrer les frais et la liquidité

Une opération n’est intéressante que si le **gain potentiel dépasse suffisamment** :

- les frais de **courtage** ;
- les **commissions de marché** ;
- les **taxes** éventuelles ;
- l’**écart** entre prix d’achat et prix de vente ;
- le risque de **mauvaise exécution**.

La BRVM indique que l’**avis d’opéré** doit présenter notamment le cours exécuté, les frais de courtage, les commissions liées à la BRVM et au DC/BR, ainsi que les taxes et le montant net.

### 5. Mesurer la performance réelle

Le trader doit suivre :

- le **taux de réussite** ;
- le **gain moyen** ;
- la **perte moyenne** ;
- le ratio **gain / perte** ;
- la **perte maximale** ;
- le rendement **après frais** ;
- le **nombre d’opérations** ;
- la performance par rapport au **BRVM-30** ou au **BRVM Composite**.

## Allocation indicative

Le portefeuille Trading **ne devrait généralement pas** représenter la totalité du patrimoine investi :

| Composante | Allocation |
|---|---|
| Positions de trading | 60 % du portefeuille trading |
| Liquidités disponibles | 30 % |
| Réserve d’opportunité ou protection | 10 % |

Il est préférable de **commencer avec une taille réduite** et d’augmenter progressivement uniquement après avoir démontré une performance **régulière après frais**.

## Erreurs fréquentes

- Trader des titres **minces** (peu d’échanges) comme s’ils étaient liquides.
- Oublier les frais : un +4 % brut peut devenir négatif net.
- **Déplacer le stop** après une perte (« ça va revenir »).
- Transformer un trade perdant en « investissement Croissance ».
- Changer d’horizon après chaque mauvaise séance.
- Risquer 5 ou 10 % du capital sur une seule idée.

## Exemple d’avis d’opéré (pédagogique)

Achat 200 actions × 5 000 = **1 000 000 FCFA**. Si frais + commissions + taxes = **15 000 FCFA**, le coût réel est **1 015 000 FCFA** (soit 5 075 FCFA / action). L’objectif 5 800 FCFA doit être relu **après** le coût de sortie également. Sans ce calcul, le plan écrit ment.`,
    example:
      "Capital 10 000 000 FCFA, risque 1 % = 100 000 FCFA. Entrée 5 000, invalidation 4 500 → 200 actions max. Objectif initial 5 800. Les frais de l’avis d’opéré s’ajoutent des deux côtés.",
    synonyms: [
      "Portefeuille spéculatif",
      "Swing trading BRVM",
      "Court terme",
      "Money management",
    ],
    resourceUrl: BRVM_INDICES,
    tip: "Pas de plan écrit + pas de plafond 0,5–1 % + pas de lecture des frais = ce n’est pas du trading, c’est de l’improvisation coûteuse.",
    source: "guide",
    ctaHref: "/outils/taille-position",
    ctaLabel: "Ouvrir la calculette de taille de position",
    relatedSlugs: [
      "cadre-quatre-portefeuilles-brvm",
      "taille-de-position",
      "taux-perte-acceptable",
      "stop-loss-brvm",
      "liquidite",
      "gestion-du-risque",
      "portefeuille-croissance-max",
    ],
    sources: SOURCES,
  },
  {
    slug: "portefeuille-croissance-max",
    title: "Portefeuille Croissance Max",
    level: "intermediaire",
    themeSlug: "types-de-portefeuille",
    sortOrder: 5,
    definition:
      "Portefeuille qui combine trois moteurs — croissance long terme, dividendes/rente, trading tactique — plus des liquidités. Objectif : croissance optimisée grâce à une séparation claire des rôles, pas le maximum de risque.",
    details: `## Définition

Le portefeuille Croissance Max combine **trois moteurs** :

- **Croissance** : valorisation durable du capital ;
- **Dividendes** : revenus et réinvestissement ;
- **Trading** : exploitation d’opportunités à court ou moyen terme.

Son objectif n’est **pas** de prendre le maximum de risque, mais de rechercher une **croissance optimisée** du portefeuille, grâce à une **séparation claire des rôles**.

La principale erreur serait de **mélanger toutes les positions sans règles distinctes**. Une action achetée pour le trading **ne doit pas automatiquement** devenir une action de long terme parce que son cours baisse.

Lisez d’abord les trois cadres : [Croissance](/education/types-de-portefeuille/portefeuille-croissance), [Rente](/education/types-de-portefeuille/portefeuille-rente), [Trading](/education/types-de-portefeuille/portefeuille-trading). La structure et le rééquilibrage sont détaillés dans [Structure et rééquilibrage](/education/types-de-portefeuille/croissance-max-structure-reequilibrage).

## Structure recommandée

La répartition optimale dépend de l’horizon, du capital, des revenus, de la tolérance aux pertes et du temps disponible.

### Modèle équilibré

| Poche | Fonction | Allocation |
|---|---|---|
| Croissance long terme | Création de valeur | 50 % |
| Dividendes et rente | Revenus et stabilité | 25 % |
| Trading | Opportunités tactiques | 15 % |
| Liquidités | Protection et opportunités | 10 % |

### Modèle plus offensif

| Poche | Allocation |
|---|---|
| Croissance | 55 % |
| Dividendes | 20 % |
| Trading | 20 % |
| Liquidités | 5 % |

### Modèle plus prudent

| Poche | Allocation |
|---|---|
| Croissance | 40 % |
| Dividendes et obligations | 35 % |
| Trading | 10 % |
| Liquidités | 15 % |

## Structure la plus solide (rappel du guide)

En pratique, la structure la plus solide pour une stratégie Croissance Max est généralement :

- une **majorité** en croissance long terme ;
- une part **significative** en dividendes et obligations ;
- une poche Trading **limitée et strictement contrôlée** ;
- une **réserve de liquidités** ;
- un **rééquilibrage périodique** ;
- une évaluation de la performance **après frais**.

## Exemple d’enveloppe (modèle équilibré)

Capital total : **12 000 000 FCFA**.

| Poche | % | Montant |
|---|---|---|
| Croissance | 50 % | 6 000 000 FCFA |
| Rente | 25 % | 3 000 000 FCFA |
| Trading | 15 % | 1 800 000 FCFA |
| Liquidités | 10 % | 1 200 000 FCFA |

Dans la poche Trading, le risque par opération (0,5–1 %) se calcule sur le **capital total** ou, plus prudent, sur la poche trading seule — mais il doit être **écrit à l’avance**. Sur 12 000 000 FCFA à 1 %, le risque max par trade = **120 000 FCFA** ; sur la poche seule à 1 %, **18 000 FCFA**.

## Ce que Croissance Max n’est pas

- Ce n’est **pas** « tout en actions agressives ».
- Ce n’est **pas** du trading avec un autre nom.
- Ce n’est **pas** une garantie de battre le BRVM Composite.
- Les pourcentages ne sont **pas** une allocation officielle de la place.

**Important** : aucune allocation ne garantit un rendement. Adaptez à votre situation personnelle.`,
    example:
      "12 000 000 FCFA en modèle équilibré : 6 000 000 Croissance, 3 000 000 Rente, 1 800 000 Trading, 1 200 000 liquidités. Chaque poche garde ses règles (thèse long terme vs plan de trade écrit).",
    synonyms: [
      "Portefeuille mixte",
      "Poches Croissance Rente Trading",
      "Core satellite BRVM",
      "Allocation multi-stratégies",
    ],
    resourceUrl: BRVM,
    tip: "Séparer les poches n’est pas de la paperasse : c’est ce qui empêche un mauvais trade de contaminer une bonne ligne de long terme.",
    source: "guide",
    ctaHref: "/education/types-de-portefeuille/croissance-max-structure-reequilibrage",
    ctaLabel: "Voir structure, notation et rééquilibrage",
    relatedSlugs: [
      "cadre-quatre-portefeuilles-brvm",
      "croissance-max-structure-reequilibrage",
      "portefeuille-croissance",
      "portefeuille-rente",
      "portefeuille-trading",
      "gestion-du-risque",
    ],
    sources: SOURCES,
  },
  {
    slug: "croissance-max-structure-reequilibrage",
    title: "Croissance Max : structure, notation et rééquilibrage",
    level: "avance",
    themeSlug: "types-de-portefeuille",
    sortOrder: 6,
    definition:
      "Méthode de fonctionnement du cadre Croissance Max : poches séparées, grille de notation 100 points, construction progressive, rééquilibrage semestriel ou annuel, et rendement net après frais.",
    details: `## 1. Séparer les poches

Tenez un **suivi distinct** :

| Poche | Rythme de décision |
|---|---|
| Croissance | Trimestriel ou semestriel |
| Rente | Suivi des dividendes, coupons et risques |
| Trading | Décisions régies par un **plan écrit** |
| Liquidités | Réserve non investie |

Cette séparation évite de vendre une **bonne** action de long terme à cause d’un mouvement temporaire, ou de conserver une **mauvaise** position de trading par émotion.

Concrètement, le journal peut avoir une colonne **« poche »** (Croissance / Rente / Trading / Cash) en plus des champs communs (date, titre, quantité, prix, frais, stratégie, objectif, risque, résultat, erreur).

## 2. Système de notation (sur 100)

Chaque action peut être notée sur 100 — **outil pour réduire les décisions émotionnelles**, pas un remplacement de l’analyse, et **pas** le score OuestBourse (qui reste indépendant).

| Critère | Pondération |
|---|---|
| Croissance du chiffre d’affaires et du bénéfice | 25 |
| Rentabilité et marges | 20 |
| Solidité financière | 15 |
| Régularité du dividende | 15 |
| Valorisation | 15 |
| Liquidité et qualité de l’information | 10 |

Lecture :

- **80 à 100** : priorité élevée ;
- **65 à 79** : surveillance ou achat progressif ;
- **50 à 64** : position limitée ;
- **moins de 50** : éviter ou vendre selon la situation.

Une note basse sur « régularité du dividende » n’interdit pas une ligne **Croissance** (le dividende y est secondaire). Elle pèse surtout pour la poche **Rente**. Une note basse sur **liquidité** pèse surtout pour la poche **Trading**.

## 3. Construire progressivement

Pour un **nouveau** capital :

1. investir d’abord une partie dans la poche **Croissance** ;
2. constituer la poche **Rente** ;
3. conserver une **réserve** de liquidités ;
4. commencer le **trading** avec une petite allocation ;
5. augmenter la poche Trading **uniquement** si les résultats sont réguliers **après frais**.

Il est préférable de **ne pas investir tout le capital le même jour**. Un investissement progressif réduit le risque lié au mauvais timing.

Exemple : 12 000 000 FCFA reçus en une fois. Semaine 1 : 30 % en poche Croissance + 10 % cash. Trimestre 1 : compléter Croissance vers 50 % et Rente vers 25 %. Trading : 5 % d’abord, 15 % seulement après une période de journal et de performance nette positive — sinon on reste à 5 % + cash.

## 4. Rééquilibrer périodiquement

Un rééquilibrage peut être effectué **tous les six mois** ou **une fois par an**.

Exemple :

- objectif Trading : **15 %** ;
- la poche Trading monte à **25 %** après une hausse ;
- vendre une partie pour revenir vers **15 %** ;
- transférer éventuellement les gains vers la **croissance** ou la **rente**.

Le rééquilibrage **impose de prendre des bénéfices** et évite qu’une seule stratégie domine tout le portefeuille.

### Exemple FCFA

Portefeuille 12 000 000 FCFA, cibles équilibrées (50 / 25 / 15 / 10). Après une phase favorable au trading :

| Poche | Cible | Valeur actuelle | Écart |
|---|---|---|---|
| Croissance | 50 % = 6 000 000 | 5 760 000 (48 %) | −2 pts |
| Rente | 25 % = 3 000 000 | 2 880 000 (24 %) | −1 pt |
| Trading | 15 % = 1 800 000 | 3 000 000 (25 %) | +10 pts |
| Liquidités | 10 % = 1 200 000 | 360 000 (3 %) | −7 pts |
| **Total** | 100 % | 12 000 000 |  |

Action pédagogique : réduire le trading d’environ **1 200 000 FCFA** pour revenir vers 15 %, et réalimenter cash et/ou croissance. Ce n’est pas un ordre : c’est la **mécanique** du rééquilibrage. Intégrez les **frais** : rééquilibrer trop souvent (mensuel) peut coûter plus que le bénéfice de la discipline.

## 5. Mesurer le rendement total

Inclure :

- les dividendes ;
- les coupons ;
- les plus-values **réalisées** ;
- les plus-values **latentes** ;
- les **frais** ;
- les **pertes** ;
- les **liquidités non investies**.

$$
\\text{Rendement net} = \\frac{\\text{Valeur finale} + \\text{revenus encaissés} - \\text{capital investi} - \\text{frais}}{\text{capital investi}}
$$

Comparez aussi la performance à un indice de référence, par exemple le **BRVM Composite** ou le **BRVM-30**. La BRVM publie ces indices ainsi que des indices **sectoriels** et un indice **Composite Total Return**.

## Rappel des règles communes

- Diversification raisonnable (10–15 lignes bien suivies plutôt que 40 mal suivies).
- Pas l’argent du quotidien.
- Quatre questions avant achat (pourquoi, scénario, invalidation, conditions de vente).
- Journal d’opérations, surtout pour le trading.

Voir le [cadre des quatre portefeuilles](/education/types-de-portefeuille/cadre-quatre-portefeuilles-brvm) pour le tableau de synthèse.

## Erreurs fréquentes

- Une seule liste de titres sans colonne « poche ».
- Noter 90/100 « au feeling » puis acheter 30 % du capital.
- Rééquilibrer chaque semaine (frais).
- Ne jamais rééquilibrer (la poche gagnante mange les autres).
- Oublier le cash dans le rendement (« tout est investi donc je performe »).`,
    example:
      "Cible Trading 15 %. Après hausse, la poche pèse 25 % d’un portefeuille de 12 000 000 FCFA (3 000 000). Revenir à 15 % implique de alléger ~1 200 000 FCFA, frais déduits, souvent vers cash ou croissance.",
    synonyms: [
      "Rééquilibrage de portefeuille",
      "Poches et notation",
      "Rendement net",
      "Asset allocation BRVM",
    ],
    resourceUrl: BRVM_INDICES,
    tip: "La note sur 100 et le rééquilibrage 6–12 mois sont des garde-fous émotionnels. Ils ne remplacent ni l’analyse, ni le journal, ni le respect des frais.",
    source: "guide",
    ctaHref: "/simulation",
    ctaLabel: "Tester une projection (outil pédagogique)",
    relatedSlugs: [
      "portefeuille-croissance-max",
      "cadre-quatre-portefeuilles-brvm",
      "portefeuille-croissance",
      "portefeuille-rente",
      "portefeuille-trading",
      "taille-de-position",
      "gestion-du-risque",
    ],
    sources: SOURCES,
  },
];
