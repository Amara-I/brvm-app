# Design system — OuestBourse (redesign fintech)

Notes before/after for the premium UI pass. Palette **key names** (`bg`, `panel`, `gold`, `green`…) are unchanged. Signal labels, tab emojis, and sidebar+tabs layout are unchanged.

## Before

- Marketing-sized, **centered** page titles (`clamp(2.35rem…3.35rem)`) on data pages.
- Body type at 20px — airy but not competitive with Bloomberg / TradingView density.
- White canvas + grey-green panels that flattened hierarchy.
- Search was a 34px icon; no keyboard shortcut.
- Empty/news/screener states were unstyled paragraphs.
- Prices and % changes mixed proportional Inter without a numeric stack.
- Signal labels were raw colored text, not badges.
- Chrome (sidebar/topbar) sat on the same white as content.

## After

- **Token system** in `app/globals.css`: surfaces (`--c-elevated`, `--c-inset`), spacing, radius, shadows, motion, numeric font, type scale.
- **Primitives** in `app/ui.css` + `components/ui/*`: `PageHeader`, `EmptyState`, `ErrorState`, `ChangeValue`, `SignalBadge`, `KpiStat`, `Surface`, skeletons.
- Canvas/card inversion (light): sage canvas `--c-bg`, white `--c-panel` cards with hairline + shadow.
- Dark mode keeps the original gold/dark hexes; adds elevation tokens only.
- **IBM Plex Mono** for prices, KPI, % changes (`font-variant-numeric: tabular-nums`).
- Left-aligned product chrome; landing hero left-aligned; compact header (~56px).
- Grouped sidebar (Investir / Marché / Ressources).
- Header search as a command field + `/` shortcut.
- Polished empty states (actualités, screener, graphes, portefeuille, outils).
- Price hierarchy: large tabular price + pill % change on fiches; colored % on marché/screener.

## Non-negotiables respected

- `C` key names identical; `reference/BRVM_Dashboard.jsx` untouched.
- French copy of signals: ACHAT FORT / ACHAT / CONSERVER / ALLÉGER / VENDRE.
- Missing data → `N/D` (styled, never invented).
- Guest portfolio demo still labelled « Chiffres illustratifs ».
