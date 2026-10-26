export const legal = {
  metaTitle: "Mentions légales — OuestBourse",
  metaDescription:
    "Mentions légales, origine des données, protection des données personnelles et disclaimer financier de OuestBourse.",
  title: "Mentions légales",
  updated: "Dernière mise à jour : conformément au déploiement de l'étape 9 de la feuille de route (cf. AGENTS.md).",
  origin: {
    title: "Origine et fiabilité des données",
    intro:
      "Les données financières présentées (cours de clôture, dividendes, ratios) sont issues, par ordre de priorité de fiabilité en cas de divergence entre sources :",
    brvmName: "BRVM.org",
    brvm:
      " — source officielle de la Bourse Régionale des Valeurs Mobilières. Utilisée comme source de vérité principale pour les cours, volumes et capitalisations.",
    sikaName: "Sikafinance.com",
    sika: " — portail d'actualités et de marché, utilisé en complément pour les indices et l'actualité.",
    richName: "Richbourse.com",
    rich: " — plateforme d'informations boursières, utilisée en croisement/vérification des ratios financiers.",
    manual: "Saisie manuelle — utilisée uniquement en secours si les trois sources automatisées échouent simultanément.",
    audit:
      "Tout écart supérieur à 2% entre deux sources pour une même donnée est enregistré et audité manuellement. La source et l'horodatage de synchronisation de la donnée retenue sont affichés de façon transparente dans la fiche de chaque société cotée.",
    affiliation:
      "OuestBourse n'est affilié à aucune des sources citées ; leurs noms sont mentionnés à titre d'attribution des données, conformément à un usage raisonnable et non commercial de contenus publiquement accessibles.",
  },
  disclaimer: {
    title: "Avertissement financier",
    p1Before:
      "⚠️ Les informations, indicateurs, scores, signaux (« ACHAT », « CONSERVER », « VENDRE », etc.) et projections de cours présentés sur OuestBourse sont fournis à titre ",
    p1Emphasis: "purement informatif et pédagogique",
    p1After:
      ". Ils reposent sur des modèles statistiques simples (régression linéaire sur données historiques) et ne prennent en compte ni l'actualité de l'émetteur, ni les conditions de marché futures, ni la situation personnelle de l'investisseur.",
    p2: "Ces éléments ne constituent en aucun cas un conseil en investissement, une recommandation d'achat ou de vente, ni une sollicitation au sens de la réglementation applicable dans l'espace UEMOA. Les performances passées ne préjugent pas des performances futures. Investir sur un marché financier comporte un risque de perte en capital.",
    p3: "Avant toute décision d'investissement, il est recommandé de consulter un conseiller financier agréé et de se référer aux communiqués officiels des sociétés cotées ainsi qu'aux avis de la BRVM.",
  },
  privacy: {
    title: "Protection des données personnelles (RGPD)",
    collectedLabel: "Données collectées",
    collected:
      " — lors de la création d'un compte : adresse email, mot de passe (haché, jamais stocké en clair), nom (facultatif). Dans le cadre de la fonctionnalité « Portefeuille » : les positions saisies par l'utilisateur (société, quantité, prix d'achat).",
    purposeLabel: "Finalité",
    purpose:
      " — ces données sont utilisées exclusivement pour permettre l'authentification et le suivi d'un portefeuille personnel. Elles ne sont ni revendues, ni partagées avec des tiers à des fins commerciales.",
    cookiesLabel: "Cookies",
    cookies:
      " — seul un cookie de session strictement nécessaire au fonctionnement de l'authentification est déposé (NextAuth.js). Aucun cookie de mesure d'audience ou publicitaire n'est utilisé à ce jour ; si cela devait changer, un bandeau de consentement serait mis en place au préalable.",
    analyticsLabel: "Mesure d'usage (première partie)",
    analytics:
      " — afin d'améliorer le produit, OuestBourse enregistre des événements d'usage agrégés (page visitée, fonctionnalité cliquée) dans sa propre base. Aucune adresse e-mail, nom, adresse IP ou contenu de formulaire n'est stocké dans ces événements. Un identifiant de session anonyme (stocké en localStorage) permet d'estimer le nombre de visiteurs distincts. Les événements sont conservés 90 jours. Si vous êtes connecté, seul l'identifiant interne du compte peut être associé à l'événement, jamais votre e-mail.",
    rightsLabel: "Vos droits",
    rights:
      " — conformément à la réglementation applicable en matière de protection des données, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Pour exercer ces droits ou pour toute question, contactez l'éditeur de l'application à l'adresse indiquée dans les informations éditeur ci-dessous.",
  },
  publisher: {
    title: "Éditeur",
    body: "Application développée à titre de projet d'analyse financière indépendant. Coordonnées de contact à compléter par l'éditeur avant mise en production (nom, adresse, email de contact, hébergeur).",
  },
} as const;
