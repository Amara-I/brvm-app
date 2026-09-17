# Agent App Designer — OuestBourse

Cadre issu de `requirements_agent_app_designer.md`. L'agent **propose** ; il n'applique jamais automatiquement de changement production.

## Contenu

| Chemin | Rôle |
|--------|------|
| `PROPOSAL_TEMPLATE.md` | Modèle de proposition quotidienne |
| `proposals/` | Propositions datées (`AD-YYYY-MM-DD-###.md`) |
| `reports/` | Synthèses de veille |

## Activation

1. `.env` : `RESEARCH_AGENT_ENABLED=true` (optionnel : `RESEARCH_SEARCH_API_KEY` SerpAPI)
2. Cron Vercel : `GET /api/cron/research` chaque jour à **06:00 UTC** (`vercel.json`)
3. En local : `npm run research:run` (veille + brouillons propositions)

## Commandes

```bash
# Veille + génération de propositions du jour
npm run research:run

# Uniquement (re)générer des brouillons depuis les findings NOUVEAU
npm run design:proposals
```

## Revue

- Propositions Markdown : `docs/design-agent/proposals/`
- Findings DESIGN/UX : page `/outils` (filtre DESIGN)
- Valider/rejeter en indiquant l'ID en chat

## Règles

- Evidence ≥ `repeated_pattern` ou `internal_evidence` pour auto-proposer « fort ».
- Zones protégées : `lib/calc/**`, ingestion, auth, secrets, textes légaux.
- KPI obligatoire + plan de rollback dans chaque proposition.
