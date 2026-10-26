export const directory = {
  companies: {
    metaTitle: "Sociétés cotées — OuestBourse",
    metaDescription:
      "Liste des sociétés cotées à la BRVM, classées par secteur, avec cours, capitalisation et signaux d'analyse.",
    eyebrow: "La cote BRVM",
    title: "Sociétés cotées",
    leadBefore: "Ensemble des émetteurs suivis sur la ",
    leadMid: " (Bourse Régionale des Valeurs Mobilières, zone UEMOA). Les sociétés sont regroupées par ",
    leadSector: "catégorie sectorielle",
    leadAfter:
      " pour faciliter la comparaison entre pairs. Chaque fiche détaille le signal d'analyse, l'historique et les projections.",
    issuers: "{count} émetteurs",
    sectors: "{count} secteurs",
    countries: "{count} pays",
    history: "Historique {span}",
    tocAria: "Catégories sectorielles",
    tocLabel: "Aller à une catégorie",
    capReported: "Cap. renseignée : {amount} ({withCap}/{total})",
    capReportedNd: "Cap. renseignée : N/D",
    price: "Cours",
    mktCap: "Cap. boursière",
    mktCapShort: "{amount} Mds",
    dividendYield: "Rend. div.",
    score: "Score",
    sheet: "Fiche →",
    fullSheet: "Fiche & analyse complète →",
    note: "Sources : données canoniques BRVM / Sikafinance / Richbourse réconciliées en base. Les capitalisations ou PER absents s'affichent « N/D ». Analyse informative uniquement — ne constitue pas un conseil en investissement.",
    legalLink: "Mentions légales",
    sectorsBlurb: {
      banques:
        "Établissements bancaires de l'UEMOA cotés à la BRVM : activité de crédit, collecte de dépôts et services financiers. Souvent suivis pour le rendement du dividende et la solidité du bilan.",
      consoBase:
        "Biens de consommation courante (alimentaire, boissons, produits d'hygiène). Demande relativement stable, titres souvent regardés pour la récurrence des revenus.",
      consoDiscretionnaire:
        "Biens et services non essentiels (distribution, équipements, loisirs). Plus sensibles au cycle économique et au pouvoir d'achat des ménages.",
      divertissement:
        "Activités de médias, loisirs et divertissement cotées sur la place. Univers restreint à la BRVM — chaque titre doit être lu individuellement.",
      energie:
        "Producteurs et distributeurs d'énergie (hydrocarbures, gaz, services associés). Sensibles aux prix des matières et à la régulation nationale.",
      industrie:
        "Industries manufacturières et transformation. Performance liée à l'investissement productif, aux coûts d'intrants et à la demande régionale.",
      servicesPublics:
        "Services d'intérêt général (eau, électricité, infrastructures). Profil souvent défensif, avec une composante réglementaire importante.",
      telecoms:
        "Opérateurs de télécommunications. Forte présence dans les indices BRVM, suivis pour la croissance des abonnés, le cash-flow et la politique de dividende.",
      autres:
        "Sociétés dont le secteur officiel ne rentre pas dans les catégories ci-dessus, ou classification encore partielle en base.",
      fallback:
        "Sociétés classées dans le secteur « {sector} » selon la nomenclature retenue en base (sources BRVM / Richbourse).",
    },
    recapDividend: "Dividende : rendement {yield}% · PER {per}",
    recapRisk: "Risque : {tier} ({score}/100){vol}",
    recapVol: " · volatilité {vol}%",
    recapHorizons: "Horizons C/M/L : {court} / {moyen} / {long} · fond. {fundamental}/100",
  },
  news: {
    metaTitle: "Actualités — OuestBourse",
    metaDescription: "Actualités du marché BRVM agrégées depuis les sources officielles et partenaires.",
    kicker: "Veille marché",
    title: "Actualités",
    lead: "L’essentiel du marché BRVM, agrégé depuis BRVM officiel, Sikafinance et Richbourse.",
    emptyTitle: "Aucune actualité pour l’instant",
    emptyBody:
      "L’ingestion automatique des actualités n’est pas encore activée. Dès que les sources officielle et partenaires alimenteront le flux, les titres apparaîtront ici — rien n’est inventé en attendant.",
  },
} as const;
