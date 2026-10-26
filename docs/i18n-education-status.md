# Education i18n status

French remains the catalog source of truth (`lib/education/catalog.ts` is unchanged).
English is an overlay in `lib/education/localize.ts`: locale `fr` returns the French
objects as stored; locale `en` replaces fields only when an English entry exists.
Any article without an overlay stays in French and shows `education.untranslatedNotice`
on its page.

## Translated in full

Categories (4/4) and themes (16/16): titles and blurbs.
Level labels: Débutant, Intermédiaire, Avancé.
Hub, theme and article chrome (search, empty state, breadcrumbs, section labels).

Term articles with English title, definition, details, example and tip (22):

Mapped from the short names in the brief to the slugs that exist in the catalog:

| Brief name | Catalog slug |
| --- | --- |
| action | `action` |
| dividende | `dividende` |
| rendement | `rendement-du-dividende` (no term slug `rendement`; that slug is a theme) |
| per | `per-price-earnings-ratio` |
| capitalisation | `capitalisation-boursiere` |
| indice | `indice-boursier` |
| cours | `cours` |
| signal | `signal-ouestbourse` |
| score | `score-composite` |
| confiance | `confiance-du-signal` |
| volatilite | `volatilite` |
| liquidite | `liquidite` |
| rsi | `rsi` |
| macd | `macd` |

Plus every `menu-*` article:

- `menu-accueil`
- `menu-marche`
- `menu-screener`
- `menu-graphes`
- `menu-fiche-societe`
- `menu-portefeuille`
- `menu-alertes`
- `menu-calendrier-dividendes`

**22 translated / 84 still French** (106 terms in the catalog).

## Still shown in French (84)

- `adx`
- `allocation-sectorielle`
- `bandes-de-bollinger`
- `benefice-net`
- `beta`
- `bourse`
- `bpa-eps`
- `brvm`
- `capex-opex`
- `cci`
- `chandeliers-ohlc`
- `chiffre-d-affaires`
- `conseil-portefeuille`
- `cours-au`
- `cout-d-achat`
- `cvar-expected-shortfall`
- `date-ex-dividende`
- `dette-equite`
- `donnee-n-d`
- `drawdown-maximal`
- `effet-de-levier`
- `ema`
- `ev-ebitda`
- `evolution-portefeuille`
- `fcfe`
- `gestion-du-risque`
- `golden-cross-death-cross`
- `hedging-couverture`
- `horizon-d-achat`
- `horizons-c-m-l`
- `ichimoku-kinko-hyo`
- `limites-de-l-analyse`
- `marche-baissier-bear-market`
- `marche-haussier-bull-market`
- `marche-primaire`
- `marche-secondaire`
- `marge-beneficiaire`
- `moyenne-mobile`
- `obv`
- `ordre-de-bourse`
- `parcours-d-analyse`
- `performance-ytd`
- `piotroski-f-score`
- `plus-moins-value-latente`
- `portefeuille`
- `portefeuille-croissance`
- `portefeuille-croissance-max`
- `portefeuille-regles-communes`
- `portefeuille-rente`
- `portefeuille-trading`
- `pourquoi-analyser-une-action`
- `prime-de-risque`
- `projection-future`
- `pru`
- `retracement-de-fibonacci`
- `risque`
- `risque-de-marche`
- `risque-fondamental`
- `risque-operationnel`
- `roe`
- `roic`
- `sante-financiere`
- `score-fondamental`
- `score-technique`
- `screener`
- `sgi`
- `source-canonique`
- `stochastique`
- `stop-loss-brvm`
- `support-et-resistance`
- `taille-de-position`
- `taux-perte-acceptable`
- `theorie-des-vagues-d-elliott`
- `type-analyse-fondamentale`
- `type-analyse-technique`
- `type-analyse-valorisation`
- `types-de-portefeuille`
- `uemoa`
- `valeur-de-marche`
- `valeur-intrinseque`
- `var-value-at-risk`
- `vente-a-decouvert`
- `wacc`
- `williams-r`

Long article blocks (`blocks`) and the portfolio-type comparison table on
`/education/types-de-portefeuille` stay French with those articles. The table
headers and shared rules live in `lib/portfolio-types` and were not rewritten.
