// ═══════════════════════════════════════════════════════════════════════════
// COMPANIES_FULL — copie fidèle des données codées en dur dans
// `reference/BRVM_Dashboard.jsx` (extraites le 09/08/2026), converties en
// TypeScript typé pour servir de source unique au script `prisma/seed.ts`.
//
// ⚠️ Ce fichier NE DOIT PAS diverger de `reference/BRVM_Dashboard.jsx` sans
// mettre à jour ce dernier en parallèle (ou mieux : une fois l'étape 4/8
// terminée, le JSX consommera l'API au lieu de ce tableau, et ce fichier ne
// servira plus qu'à documenter l'origine historique des données seed).
//
// Aucune donnée n'a été ajoutée, retirée ou arrondie par rapport au JSX :
// les 20 premières sociétés, leurs 12 années de cours (2015-2026) et de
// dividendes sont reprises à l'identique (les valeurs à 0 signifient
// "société non cotée / donnée non disponible cette année-là", comme dans le
// composant d'origine — elles ne sont volontairement PAS insérées en base,
// cf. `prisma/seed.ts`, pour ne pas polluer `price_history`/`dividends` avec
// de faux zéros).
//
// ⚠️ MISE À JOUR — 27 sociétés manquantes ajoutées le 10/08/2026, demande
// explicite de l'utilisateur ("screener le net pour ajouter les actions
// manquantes"). `reference/BRVM_Dashboard.jsx` ne couvrait que 20 des 47
// sociétés réellement cotées à la BRVM (le JSX était un ÉCHANTILLON fourni
// au démarrage du projet, pas la liste officielle complète — cf. AGENTS.md
// § Étape 13). Les 27 sociétés ci-dessous, ajoutées À LA SUITE des 20
// premières (jamais modifiées), proviennent d'un criblage réel de
// https://www.brvm.org (Bulletin Officiel de la Cote, DC/BR du jour) et
// https://www.richbourse.com/common/apprendre/liste-societes (secteur/pays
// officiels) le 10/08/2026 :
//   - `sector` reprend la classification SECTORIELLE OFFICIELLE de la BRVM
//     (Services financiers → "Banques", Télécommunications → "Télécoms",
//     Consommation de base → "Conso. Base", Services publics →
//     "Services Publics", Industriels → "Industrie", Energie → "Énergie",
//     tel qu'utilisé par les 20 sociétés d'origine) — SAUF "Consommation
//     discrétionnaire", secteur officiel absent du jeu de données d'origine
//     (seule LNBB s'en approchait, taguée "Divertissement", non touchée),
//     mappé ici vers un nouveau libellé additif "Conso. Discrétionnaire"
//     (le filtre par secteur du dashboard est déjà 100% dynamique — cf.
//     `SECTORS` dans `BrvmDashboardClient.tsx` — donc purement additif).
//   - `prices` : SEULE l'année 2026 (cours du jour réel, DC/BR du
//     10/08/2026) est renseignée ; 2015-2025 = 0 ("N/D", cf. convention
//     ci-dessus) car un historique multi-année fiable par scraping n'était
//     pas disponible dans cet environnement — même limitation honnête que
//     BICB dans le jeu d'origine (2 ans seulement). `calcMetrics`/
//     `projectPrices` gèrent déjà ce cas (perf5/perf10 → "N/D").
//   - `per` : PER individuel réel extrait du Bulletin Officiel de la Cote
//     (BOC n°119, 26/06/2026, colonne "PER" par titre) quand disponible ;
//     à défaut (SCRC, SICC, STAC, UNXC — BNPA non publié/non calculable ce
//     jour-là), repli documenté sur le PER MOYEN du secteur officiel
//     concerné (indices sectoriels BRVM, même BOC) plutôt qu'une valeur
//     inventée.
//   - `dividends` : dernier dividende net par action réellement payé et sa
//     date (BOC), placé sur l'année civile de paiement ; omis (0 = N/D) si
//     la date connue est trop ancienne (hors 2015-2026) ou introuvable.
//   - `mktcap` : capitalisation réelle seulement quand une source publique
//     fiable la donnait explicitement (SIBC, SMBC, SPHC, TTLC — cf.
//     brvm.org "Liste des sociétés Prestige") ; 0 = "N/D" sinon (jamais
//     estimée/inventée à partir d'un nombre de titres non confirmé — le
//     dashboard affiche déjà "N/D" pour `mktcap = 0`, cf.
//     `app/societes-cotees/page.tsx`).
// ═══════════════════════════════════════════════════════════════════════════

export interface CompanySeed {
  ticker: string;
  name: string;
  country: string;
  sector: string;
  /// Emoji drapeau tel qu'utilisé dans l'UI existante.
  flag: string;
  /// PER "actuel" tel qu'affiché dans le JSX (valeur unique, non historisée
  /// par année à l'origine — cf. commentaire dans prisma/seed.ts).
  per: number;
  /// Capitalisation boursière "actuelle", en milliards de FCFA.
  mktcap: number;
  /// Cours de clôture par année (FCFA). 0 = non coté / donnée absente.
  prices: Record<number, number>;
  /// Dividende par action et par année (FCFA). 0 = aucun dividende versé.
  dividends: Record<number, number>;
  /// Couleur hexadécimale utilisée pour les graphes/badges dans l'UI.
  color: string;
}

export const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

/// Tickers des 20 sociétés d'origine (reference/BRVM_Dashboard.jsx).
/// Utilisé par les tests de non-régression et le générateur de golden
/// fixtures : les 27 sociétés ajoutées le 10/08/2026 n'ont PAS de
/// référence dans le JSX et ne doivent PAS polluer la fixture figée.
export const LEGACY_COMPANY_TICKERS = [
  "SNTS", "ORAC", "ONTBF", "CBIBF", "BOAB", "LNBB", "BICB", "SGBC", "NSBC", "ECOC",
  "STBC", "SLBC", "BOABF", "SDCC", "SDSC", "PALC", "BOAN", "TTLS", "NTLC", "BOAS",
] as const;

export const COMPANIES_FULL: CompanySeed[] = [
  { ticker: "SNTS", name: "Sonatel", country: "Sénégal", sector: "Télécoms", flag: "🇸🇳",
    per: 7.01, mktcap: 810,
    prices: { 2015: 14000, 2016: 16000, 2017: 18500, 2018: 19000, 2019: 20500, 2020: 22000, 2021: 24000, 2022: 25500, 2023: 27000, 2024: 27500, 2025: 28000, 2026: 32000 },
    dividends: { 2015: 900, 2016: 1050, 2017: 1100, 2018: 1150, 2019: 1200, 2020: 1225, 2021: 1400, 2022: 1500, 2023: 1575, 2024: 1655, 2025: 1655, 2026: 1655 },
    color: "#D4A843" },
  { ticker: "ORAC", name: "Orange CI", country: "Côte d'Ivoire", sector: "Télécoms", flag: "🇨🇮",
    per: 10.2, mktcap: 390,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 12000, 2023: 14500, 2024: 15200, 2025: 15500, 2026: 17000 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 753, 2023: 780, 2024: 660, 2025: 660, 2026: 660 },
    color: "#FF6B35" },
  { ticker: "ONTBF", name: "ONATEL BF", country: "Burkina Faso", sector: "Télécoms", flag: "🇧🇫",
    per: 9.25, mktcap: 48,
    prices: { 2015: 1800, 2016: 1900, 2017: 2000, 2018: 2100, 2019: 2300, 2020: 2500, 2021: 2600, 2022: 2700, 2023: 2750, 2024: 2800, 2025: 2820, 2026: 2910 },
    dividends: { 2015: 100, 2016: 108, 2017: 115, 2018: 120, 2019: 132, 2020: 143, 2021: 155, 2022: 165, 2023: 175, 2024: 190, 2025: 190, 2026: 190 },
    color: "#14B8A6" },
  { ticker: "CBIBF", name: "Coris Bank BF", country: "Burkina Faso", sector: "Banques", flag: "🇧🇫",
    per: 8.5, mktcap: 320,
    prices: { 2015: 4000, 2016: 5000, 2017: 6500, 2018: 7500, 2019: 9000, 2020: 10500, 2021: 12000, 2022: 14500, 2023: 17000, 2024: 19500, 2025: 21000, 2026: 28450 },
    dividends: { 2015: 80, 2016: 100, 2017: 130, 2018: 160, 2019: 180, 2020: 200, 2021: 280, 2022: 350, 2023: 430, 2024: 555, 2025: 555, 2026: 555 },
    color: "#A855F7" },
  { ticker: "BOAB", name: "BOA Bénin", country: "Bénin", sector: "Banques", flag: "🇧🇯",
    per: 9.8, mktcap: 120,
    prices: { 2015: 2000, 2016: 2500, 2017: 3000, 2018: 3500, 2019: 3800, 2020: 4200, 2021: 5100, 2022: 6000, 2023: 7200, 2024: 8500, 2025: 8800, 2026: 8650 },
    dividends: { 2015: 80, 2016: 100, 2017: 120, 2018: 150, 2019: 175, 2020: 200, 2021: 270, 2022: 310, 2023: 380, 2024: 468, 2025: 468, 2026: 468 },
    color: "#F59E0B" },
  { ticker: "LNBB", name: "Loterie Nat. Bénin", country: "Bénin", sector: "Divertissement", flag: "🇧🇯",
    per: 8.3, mktcap: 45,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 3700, 2025: 3850, 2026: 4295 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 220, 2024: 275, 2025: 275, 2026: 275 },
    color: "#22C55E" },
  { ticker: "BICB", name: "BIIC Bénin", country: "Bénin", sector: "Banques", flag: "🇧🇯",
    per: 11.5, mktcap: 180,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 5250, 2026: 7670 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#EC4899" },
  { ticker: "SGBC", name: "SGB CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 9.8, mktcap: 590,
    prices: { 2015: 15000, 2016: 18000, 2017: 21000, 2018: 24000, 2019: 26000, 2020: 28000, 2021: 32000, 2022: 34000, 2023: 35000, 2024: 36500, 2025: 36000, 2026: 39000 },
    dividends: { 2015: 450, 2016: 550, 2017: 650, 2018: 750, 2019: 820, 2020: 900, 2021: 1100, 2022: 1400, 2023: 1646, 2024: 2293, 2025: 2293, 2026: 2293 },
    color: "#3B82F6" },
  { ticker: "NSBC", name: "NSIA Banque CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 11.2, mktcap: 280,
    prices: { 2015: 6000, 2016: 7500, 2017: 9000, 2018: 10500, 2019: 11500, 2020: 12000, 2021: 14000, 2022: 15500, 2023: 17000, 2024: 18000, 2025: 18000, 2026: 23650 },
    dividends: { 2015: 130, 2016: 170, 2017: 200, 2018: 240, 2019: 265, 2020: 290, 2021: 380, 2022: 470, 2023: 530, 2024: 668, 2025: 668, 2026: 668 },
    color: "#06B6D4" },
  { ticker: "ECOC", name: "Ecobank CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 10.1, mktcap: 195,
    prices: { 2015: 5500, 2016: 7000, 2017: 8500, 2018: 10000, 2019: 10500, 2020: 11000, 2021: 13000, 2022: 14500, 2023: 15500, 2024: 16200, 2025: 16300, 2026: 16200 },
    dividends: { 2015: 170, 2016: 220, 2017: 270, 2018: 320, 2019: 355, 2020: 380, 2021: 450, 2022: 530, 2023: 600, 2024: 708, 2025: 708, 2026: 708 },
    color: "#84CC16" },
  { ticker: "STBC", name: "SITAB CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 8.59, mktcap: 105,
    prices: { 2015: 6000, 2016: 7000, 2017: 8500, 2018: 9500, 2019: 10500, 2020: 12000, 2021: 15000, 2022: 18000, 2023: 19000, 2024: 20000, 2025: 21000, 2026: 25000 },
    dividends: { 2015: 320, 2016: 380, 2017: 460, 2018: 530, 2019: 600, 2020: 675, 2021: 900, 2022: 1200, 2023: 1500, 2024: 2096, 2025: 2096, 2026: 2096 },
    color: "#F97316" },
  { ticker: "SLBC", name: "Solibra CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 13.5, mktcap: 490,
    prices: { 2015: 18000, 2016: 20000, 2017: 23000, 2018: 25000, 2019: 27000, 2020: 30000, 2021: 34000, 2022: 36000, 2023: 37000, 2024: 38000, 2025: 38000, 2026: 37005 },
    dividends: { 2015: 400, 2016: 480, 2017: 560, 2018: 620, 2019: 660, 2020: 700, 2021: 800, 2022: 900, 2023: 950, 2024: 1074, 2025: 1074, 2026: 1074 },
    color: "#EAB308" },
  { ticker: "BOABF", name: "BOA Burkina", country: "Burkina Faso", sector: "Banques", flag: "🇧🇫",
    per: 9.13, mktcap: 80,
    prices: { 2015: 1500, 2016: 1800, 2017: 2200, 2018: 2600, 2019: 2900, 2020: 3200, 2021: 3800, 2022: 4400, 2023: 5000, 2024: 5300, 2025: 5500, 2026: 7325 },
    dividends: { 2015: 80, 2016: 100, 2017: 125, 2018: 155, 2019: 185, 2020: 220, 2021: 280, 2022: 320, 2023: 370, 2024: 428, 2025: 428, 2026: 428 },
    color: "#8B5CF6" },
  { ticker: "SDCC", name: "SODE CI", country: "Côte d'Ivoire", sector: "Services Publics", flag: "🇨🇮",
    per: 7.8, mktcap: 180,
    prices: { 2015: 3000, 2016: 3500, 2017: 4200, 2018: 5000, 2019: 5800, 2020: 6500, 2021: 7500, 2022: 8500, 2023: 9500, 2024: 10500, 2025: 11000, 2026: 11890 },
    dividends: { 2015: 90, 2016: 110, 2017: 135, 2018: 165, 2019: 195, 2020: 210, 2021: 260, 2022: 290, 2023: 352, 2024: 462, 2025: 462, 2026: 462 },
    color: "#10B981" },
  { ticker: "SDSC", name: "Africa Global Log.", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 5.4, mktcap: 24,
    prices: { 2015: 600, 2016: 650, 2017: 700, 2018: 750, 2019: 820, 2020: 900, 2021: 1000, 2022: 1200, 2023: 1400, 2024: 1550, 2025: 1680, 2026: 2585 },
    dividends: { 2015: 15, 2016: 18, 2017: 22, 2018: 26, 2019: 30, 2020: 27, 2021: 34, 2022: 42, 2023: 50, 2024: 60, 2025: 60, 2026: 60 },
    color: "#F43F5E" },
  { ticker: "PALC", name: "Palm CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 9.2, mktcap: 115,
    prices: { 2015: 2200, 2016: 2600, 2017: 3200, 2018: 3800, 2019: 4200, 2020: 4500, 2021: 5500, 2022: 6500, 2023: 7000, 2024: 7500, 2025: 7800, 2026: 9100 },
    dividends: { 2015: 80, 2016: 100, 2017: 130, 2018: 165, 2019: 190, 2020: 200, 2021: 280, 2022: 330, 2023: 390, 2024: 442, 2025: 442, 2026: 442 },
    color: "#65A30D" },
  { ticker: "BOAN", name: "BOA Niger", country: "Niger", sector: "Banques", flag: "🇳🇪",
    per: 7.9, mktcap: 38,
    prices: { 2015: 1200, 2016: 1400, 2017: 1700, 2018: 2000, 2019: 2200, 2020: 2500, 2021: 2800, 2022: 3200, 2023: 3500, 2024: 3600, 2025: 3700, 2026: 5200 },
    dividends: { 2015: 45, 2016: 58, 2017: 72, 2018: 88, 2019: 98, 2020: 100, 2021: 130, 2022: 165, 2023: 190, 2024: 209, 2025: 209, 2026: 209 },
    color: "#0EA5E9" },
  { ticker: "TTLS", name: "TotalEnergies SN", country: "Sénégal", sector: "Énergie", flag: "🇸🇳",
    per: 8.8, mktcap: 42,
    prices: { 2015: 1400, 2016: 1600, 2017: 1800, 2018: 2000, 2019: 2100, 2020: 2200, 2021: 2500, 2022: 2800, 2023: 3000, 2024: 3100, 2025: 3200, 2026: 3600 },
    dividends: { 2015: 80, 2016: 95, 2017: 110, 2018: 125, 2019: 133, 2020: 140, 2021: 160, 2022: 185, 2023: 200, 2024: 222, 2025: 222, 2026: 222 },
    color: "#FB923C" },
  { ticker: "NTLC", name: "Nestle CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 11.5, mktcap: 165,
    prices: { 2015: 5000, 2016: 6000, 2017: 7000, 2018: 8000, 2019: 8800, 2020: 9000, 2021: 10000, 2022: 11000, 2023: 12000, 2024: 13000, 2025: 13000, 2026: 16615 },
    dividends: { 2015: 200, 2016: 250, 2017: 300, 2018: 350, 2019: 380, 2020: 400, 2021: 500, 2022: 600, 2023: 675, 2024: 722, 2025: 722, 2026: 722 },
    color: "#A78BFA" },
  { ticker: "BOAS", name: "BOA Sénégal", country: "Sénégal", sector: "Banques", flag: "🇸🇳",
    per: 10.3, mktcap: 85,
    prices: { 2015: 2800, 2016: 3200, 2017: 3800, 2018: 4200, 2019: 4600, 2020: 5000, 2021: 5800, 2022: 6500, 2023: 7000, 2024: 7500, 2025: 7700, 2026: 7750 },
    dividends: { 2015: 70, 2016: 88, 2017: 108, 2018: 128, 2019: 140, 2020: 150, 2021: 200, 2022: 260, 2023: 310, 2024: 350, 2025: 350, 2026: 350 },
    color: "#34D399" },

  // ── 27 sociétés manquantes ajoutées le 10/08/2026 (+ BBGCI le 22/08/2026) ──
  { ticker: "ABJC", name: "Servair Abidjan", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 26.85, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 3010 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 206.2, 2025: 0, 2026: 0 },
    color: "#DC2626" },
  // ── Bridge Bank Group Côte d'Ivoire (BBGCI) — ajoutée le 22/08/2026 ──
  // OPV BRVM juillet 2026 (visa AMF-UMOA OA/26-03) : 10 M actions (20 %)
  // à 6 750 FCFA ; souscription clôturée en < 24 h (taux ~142 %).
  // Première cotation annoncée au 14/09/2026 — avant cette date le « cours »
  // 2026 est le prix d'OPV (référence publique), pas une clôture de marché.
  // Cap. implicite OPV ≈ 337,5 Md FCFA (50 M titres × 6 750) → mktcap 338.
  // PER ≈ 12,4 : résultat net 2025 27,2 Md FCFA / 50 M titres → BNPA ≈ 544 ;
  // 6 750 / 544 ≈ 12,4 (arrondi). Dividendes cotés : 0 jusqu'à premier
  // versement post-introduction (politique payout 65 % annoncée, non encore
  // versée aux actionnaires de marché).
  { ticker: "BBGCI", name: "Bridge Bank Group CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 12.4, mktcap: 338,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 6750 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#0F766E" },
  { ticker: "BICC", name: "BICI CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 13.23, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 29150 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 830.72, 2026: 0 },
    color: "#7C3AED" },
  // ⚠️ PER=583.21 : valeur réelle extraite du BOC (source officielle), pas
  // une erreur de saisie — plausible pour une petite capitalisation à
  // bénéfice net très faible ; documentée plutôt que "corrigée en silence".
  { ticker: "BNBC", name: "Bernabé CI", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 583.21, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 1905 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 150, 2024: 0, 2025: 0, 2026: 0 },
    color: "#059669" },
  { ticker: "BOAC", name: "BOA Côte d'Ivoire", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 10.24, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 11600 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 597.53 },
    color: "#2563EB" },
  { ticker: "BOAM", name: "BOA Mali", country: "Mali", sector: "Banques", flag: "🇲🇱",
    per: 12.03, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 5700 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 305.04 },
    color: "#D97706" },
  { ticker: "CABC", name: "Sicable CI", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 16.04, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 3500 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 152.02 },
    color: "#DB2777" },
  { ticker: "CFAC", name: "CFAO Motors CI", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 68.59, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 1695 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 7.04, 2026: 0 },
    color: "#0891B2" },
  { ticker: "CIEC", name: "CIE CI", country: "Côte d'Ivoire", sector: "Services Publics", flag: "🇨🇮",
    per: 22.18, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 5150 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 158.4, 2026: 0 },
    color: "#4D7C0F" },
  { ticker: "ETIT", name: "Ecobank Transnational TG", country: "Togo", sector: "Banques", flag: "🇹🇬",
    per: 3.51, mktcap: 1212,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 23, 2026: 67 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0.92, 2026: 0 },
    color: "#9333EA" },
  // ⚠️ Dividende 2025 = 1726,56 (rendement ~88 % du cours) : chiffre réel du
  // BOC, cohérent avec un dividende exceptionnel ponctuel — non lissé.
  { ticker: "FTSC", name: "Filtisac CI", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 59.47, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2135 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 1726.56, 2026: 0 },
    color: "#EA580C" },
  { ticker: "NEIC", name: "NEI-CEDA CI", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 15.04, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2265 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 81.78, 2025: 0, 2026: 0 },
    color: "#0D9488" },
  { ticker: "ORGT", name: "Oragroup Togo", country: "Togo", sector: "Banques", flag: "🇹🇬",
    per: 8.5, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 3110 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 59.52, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#B91C1C" },
  { ticker: "PRSC", name: "Tractafric Motors CI", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 19.88, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 4450 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 182.16, 2026: 0 },
    color: "#4338CA" },
  { ticker: "SAFC", name: "Safca (Alios Finance) CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 52.24, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 4990 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#CA8A04" },
  // PER : dernier BNPA publié non disponible ce jour-là au BOC → repli
  // documenté sur le PER moyen du secteur officiel "Consommation de base"
  // (10,02, même BOC), non inventé au niveau société.
  { ticker: "SCRC", name: "Sucrivoire CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 10.02, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 3620 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 40.5, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#16A34A" },
  { ticker: "SEMC", name: "Eviosys Packaging (Crown Siem) CI", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 127.87, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 1500 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#C026D3" },
  { ticker: "SHEC", name: "Vivo Energy CI", country: "Côte d'Ivoire", sector: "Énergie", flag: "🇨🇮",
    per: 22.0, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2290 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 75.29, 2026: 0 },
    color: "#EA4C89" },
  { ticker: "SIBC", name: "Société Ivoirienne de Banque", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 15.99, mktcap: 930,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 9320 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 330, 2026: 0 },
    color: "#1D4ED8" },
  // PER : repli documenté sur le PER moyen du secteur "Consommation de
  // base" (10,02), même motif que SCRC ci-dessus.
  { ticker: "SICC", name: "Sicor CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 10.02, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 7615 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#B45309" },
  { ticker: "SIVC", name: "Erium CI (ex Air Liquide)", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 6.59, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2280 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 92, 2026: 0 },
    color: "#0E7490" },
  { ticker: "SMBC", name: "SMB CI", country: "Côte d'Ivoire", sector: "Énergie", flag: "🇨🇮",
    per: 9.78, mktcap: 129,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 16530 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 616, 2026: 0 },
    color: "#E11D48" },
  { ticker: "SOGC", name: "SOGB CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 14.53, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 7875 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 528, 2026: 0 },
    color: "#7E22CE" },
  { ticker: "SPHC", name: "SAPH CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 7.85, mktcap: 194,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 7900 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 323.84, 2026: 0 },
    color: "#15803D" },
  // PER : repli documenté sur le PER moyen du secteur "Industriels" (24,55).
  { ticker: "STAC", name: "Setao CI", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 24.55, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2630 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 66.15, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#C2410C" },
  { ticker: "TTLC", name: "TotalEnergies Marketing CI", country: "Côte d'Ivoire", sector: "Énergie", flag: "🇨🇮",
    per: 19.78, mktcap: 177,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 2995 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 195.67, 2026: 0 },
    color: "#6D28D9" },
  // ⚠️ PER=817.47 : valeur réelle extraite du BOC (source officielle),
  // même remarque que BNBC ci-dessus (thème récurrent des petites lignes
  // BRVM à bénéfice net très faible / flottant très réduit).
  { ticker: "UNLC", name: "Unilever CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 817.47, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 54595 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#A16207" },
  // PER : repli documenté sur le PER moyen du secteur officiel
  // "Consommation discrétionnaire" (58,58).
  { ticker: "UNXC", name: "Uniwax CI", country: "Côte d'Ivoire", sector: "Conso. Discrétionnaire", flag: "🇨🇮",
    per: 58.58, mktcap: 0,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 1935 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 60.75, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#BE185D" },
];
