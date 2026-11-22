# Réparation des historiques de graphes (audit du 22/11/2026)

Données et script pour combler les trous d'historique NGX/BRVM et neutraliser
les clôtures aberrantes repérées par l'audit. **Rien n'est appliqué par la PR** :
le script s'exécute à la main, après validation.

## Contenu de `data/`

| Fichier | Lignes | Source | Confiance |
|---|---:|---|---|
| `ngx_prices.csv` | 35 001 | NGX doclib : *Daily Official List – Equities* (25 617 clôtures hebdo 2016-10 → 2021-10, 525 séances manquantes, 122 séances partielles) et *Daily Summary* (8 737 lignes, rapprochées par raison sociale, seulement les titres échangés) | high 20 030 / medium 14 971 |
| `brvm_prices.csv` | 13 878 | Sikafinance (`fetchDailyHistoryChunked`), fenêtres où la base est vide (nov.–déc. 2024, nov.–déc. 2022, SDSC, SLBC, ABJC, UNLC, BOAS/CBIBF/ECOC/ORAC/SCRC, PRSC/SICC/SPHC/STAC/NEIC…) | high 8 397 / medium 5 481 |
| `ngx_indices.csv` | 824 | NGX doclib : pages de couverture quotidiennes (ASI, NGX30, sectoriels) ; 6 valeurs ASI déduites du champ « veille » de la couverture suivante | high 818 / medium 6 |
| `outliers.csv` | 205 | Comparaison base ↔ Sikafinance ↔ voisins | voir ci-dessous |

`outliers.csv` : 109 lignes `MANUEL` canoniques (presque toutes au 31/12, souvent un
week-end, échelle erronée) rétrogradées ; 32 clôtures ABJC `SIKAFINANCE` de début de mois
corrigées à la clôture quotidienne Sikafinance ; 63 autres débuts de mois ABJC
(clôtures mensuelles mal datées) rétrogradées ; 1 point NGX isolé (CONHALLPLC 2023-11-27) rétrogradé. MORISON 2020-10-26 (0,54) est
conservé : la liste officielle hebdomadaire le confirme.

Contrôles faits en lecture seule avant la PR : ratios Sikafinance/base = 1,000 sur
toutes les fenêtres communes (SNTS : 0,1 = Sikafinance ajusté du fractionnement d'octobre 2026 ;
les 94 lignes SNTS sont donc multipliées par 10 et marquées `medium`) ; *Daily Summary* vs liste officielle :
0 écart sur ~318 comparaisons ; sur les lignes déjà présentes en base : 0 écart > 2 %
côté NGX (6 407 lignes) et indices (259), et côté BRVM uniquement les lignes traitées
par `outliers.csv`.

## Exécution

```bash
# 1. Simulation (défaut, aucune écriture)
npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts

# 2. Application (éventuellement --min-confidence=high pour commencer)
npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts --apply

# 3. Annulation complète
npx ts-node -r ./scripts/register-paths.cjs scripts/chart-history-repair/apply.ts --rollback
```

Options : `--only=outliers,ngx-prices,brvm-prices,ngx-indices,charts`, `--skip-charts`.

Garanties :
- une ligne n'est insérée que si (titre, date) n'a aucune clôture canonique ; les lignes
  existantes ne sont jamais modifiées par l'insertion (`ON CONFLICT DO NOTHING`) ;
- identifiants déterministes `chr2611_…` (prix) / `chr2611i_…` (indices) : relancer ne
  duplique rien, `--rollback` les supprime ;
- les corrections/rétrogradations vérifient l'ancienne valeur avant d'écrire et sont
  inversées par `--rollback` ;
- `chart_series` est reconstruit (`force`) pour les titres touchés et les indices NGX.

Volume attendu : ≈ 40 600 clôtures + 565 valeurs d'indices, soit ≈ 20 Mo de plus
en base (≈ 470 o/ligne index compris sur `price_history`), plus 1 à 3 Mo de
`chart_series`.

## Hors périmètre (à vérifier à la main)

- NGX 2026-11-05 : aucune source exploitable (ni liste, ni résumé, ni couverture).
- Sauts probables d'opérations sur titres NGX (STERLINGNG 2026-10-12, TRANSCORP
  2024-10-28, VFDGROUP 2024-06/2025-04, UCAP 2024-08, AFRIPRUD 2025-03…) : à
  enregistrer comme opérations sur titres si confirmés.
- BBGCI 2026-09-23 (9 000 vs 6 750/7 255) : signalé seulement.
- Indices BRVM sectoriels anciens (arrêtés) et `BRVM_FINANCES` /
  `BRVM_SERVICES_PUBLICS_ANCIEN` figés depuis le 06/11/2026.
