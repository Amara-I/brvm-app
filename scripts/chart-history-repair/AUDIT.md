# Audit des historiques de graphes — 22/11/2026 (Europe/Paris)

Base : Supabase `gwthfqdchrtruhvgtrax`, lecture seule. Dernière séance en base : **vendredi 20/11/2026**
pour les deux places (BRVM 48/48 titres actifs, NGX 146/146, indices BRVM 21/23, NGX 20/21).
Taille base : 191,9 Mo / 500 Mo (`price_history` 109,3 Mo, `market_index_values` 18,8 Mo, `chart_series` 18,2 Mo).

## 1. NGX (146 sociétés)

### Historique court
- Historique réel seulement depuis le **27/10/2021** ; avant : points isolés (28/10/2016, 26/10/2020), trou de 1 456 jours.
- Titres récents/suspendus : ZICHIS (14 séances), MULTITREX (23, nouvelle cotation), MOFIREIF (40), AVAIF (19),
  AVACAP (depuis 2026-07), FTGINSURE (2026-02), NREIT (2026-01) ; BAPLC, CHELLARAM, LIVINGTRUST, MECURE, RONCHESS,
  TIP : un point au 18/01/2024 puis rien avant le 27/10/2026.
- Illiquides/suspendus (dernière transaction ancienne dans la liste officielle) : AFRINSURE, EKOCORP, PHARMDEKO,
  GOLDBREW, UNITYBNK. JAIZBANK, JULI, MCNICHOLS, TIP absents de la liste officielle « Equities ».

### Trous
- **92 séances partielles ou manquantes** depuis 12/2021 : 85 jours à exactement 87 lignes (repli *Daily Summary*
  rapproché par nom seulement, considéré « fait » par la règle ≥ 80 lignes), 18/01/2024 = 28 lignes,
  24/09/2026 = 71, **02, 04, 05, 09 et 10/11/2026 absents**. Les 11–20/11/2026 sont complets (146/146).
- Cause : la *Daily Official List* publiée ces jours-là est périmée (tradeDate ≠ date), le repli *Daily Summary*
  ne reconnaissait que le nom court (pas la raison sociale), et un seuil fixe de 80 lignes marquait la séance
  comme terminée → jamais retraitée.
- Indices NGX : depuis 27/10/2021 seulement ; ASI manquant sur 42 séances (+05/11/2026) ; NGXASEM figé depuis 07/11/2025 ;
  ~36 dates sans aucune source.

### Aberrations
- Sauts probablement dus à des opérations sur titres, à confirmer : STERLINGNG 12/10/2026 (7,7 → 76), TRANSCORP 28/10/2024,
  VFDGROUP 06/2024 et 04/2025, UCAP 08/2024, AFRIPRUD 03/2025.
- Points isolés incohérents : CONHALLPLC 27/11/2023, MORISON 26/10/2020.

### Données obsolètes
- Aucune (dernière séance 20/11/2026), hormis NGXASEM.

## 2. BRVM (48 sociétés)

### Historique court
- PRSC, SICC, SPHC, STAC, UNLC : depuis 2025 seulement ; NEIC : un point 2016 puis 2025 (Sikafinance couvre depuis 11/2016).
- BICB, LNBB, BBGCI, ORAC : introductions récentes (légitime).

### Trous
- **01/11/2024 → 31/12/2024** : quasiment tous les titres.
- Nov.–déc. 2022 partiel ; BOAS, CBIBF, ECOC, ORAC, SCRC : seulement des points de fin d'année 2022–2024 ;
  SLBC : trous 2024 ; SEMC : suspendu 2024–2025 (9 lignes Sikafinance) ; SDSC : 06→10/2025 et 07→09/2026 ;
  ABJC : 07→09/2025 en mensuel ; UNLC : 08/2025.
- Indices : anciens sectoriels arrêtés (47 points sur 1 an), BRVM_SP clairsemé (39), BRVM_COMPOSITE_TOTAL_RETURN (18),
  BRVM_FINANCES et BRVM_SERVICES_PUBLICS_ANCIEN figés depuis 06/11/2026, BRVM_PRINCIPAL et nouveaux sectoriels : trous de 21–22 jours.

### Aberrations
- **115 lignes `MANUEL` canoniques** (114 au 31/12, 70 un week-end), majoritairement à la mauvaise échelle.
  109 rétrogradées dans la PR, 6 conservées (écart < 10 % : BOAN 2023-12-31, NSBC 2017, PALC 2023, SDSC 2023, STBC 2016, TTLS 2017).
- **ABJC** : clôtures mensuelles Sikafinance datées au 1er du mois : 32 corrigées (clôture quotidienne Sikafinance), 63 rétrogradées.
- SNTS 26/10/2026 : fractionnement réel (pas une erreur).
- BBGCI 23/09/2026 : 9 000 vs 6 750 / 7 255 (signalé seulement).
- 76 lignes datées un week-end (en grande partie les `MANUEL` ci-dessus).

### Données obsolètes
- Aucune pour les titres ; deux indices figés (voir plus haut).

## 3. Réparation proposée (PR, non appliquée)

| Jeu | Candidats | À insérer (simulation SQL) | Déjà présents | Écarts > 2 % |
|---|---:|---:|---:|---:|
| Prix NGX | 35 001 | 28 594 | 6 407 | 0 |
| Prix BRVM (Sikafinance) | 13 878 | 11 994 | 1 884 | 24 (tous traités par `outliers.csv`) |
| Indices NGX | 824 | 565 | 259 | 0 |
| Aberrations | 206 | 174 rétrogradations, 32 corrections | | |

Croissance estimée : ≈ 40 600 × 470 o ≈ 19 Mo (prix) + 0,2 Mo (indices) + 1–3 Mo (`chart_series`) ≈ **20–22 Mo**,
soit ~212 Mo / 500 Mo.

Correctifs de code : complétude de séance NGX relative (médiane des voisins ±21 j, seuil 90 %) au lieu du
seuil fixe de 80 ; rapprochement *Daily Summary* sur nom **et** raison sociale ; rattrapage automatique des
séances NGX manquantes/partielles des 7 derniers jours ouvrés dans l'ingestion quotidienne (2 séances max par run).
