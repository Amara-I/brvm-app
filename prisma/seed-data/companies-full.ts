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
// les 20 sociétés, leurs 12 années de cours (2015-2026) et de dividendes
// sont reprises à l'identique (les valeurs à 0 signifient "société non
// cotée / donnée non disponible cette année-là", comme dans le composant
// d'origine — elles ne sont volontairement PAS insérées en base, cf.
// `prisma/seed.ts`, pour ne pas polluer `price_history`/`dividends` avec de
// faux zéros).
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

export const COMPANIES_FULL: CompanySeed[] = [
  { ticker: "SNTS", name: "Sonatel", country: "Sénégal", sector: "Télécoms", flag: "🇸🇳",
    per: 7.01, mktcap: 810,
    prices: { 2015: 14000, 2016: 16000, 2017: 18500, 2018: 19000, 2019: 20500, 2020: 22000, 2021: 24000, 2022: 25500, 2023: 27000, 2024: 27500, 2025: 28000, 2026: 28450 },
    dividends: { 2015: 900, 2016: 1050, 2017: 1100, 2018: 1150, 2019: 1200, 2020: 1225, 2021: 1400, 2022: 1500, 2023: 1575, 2024: 1655, 2025: 1655, 2026: 1655 },
    color: "#D4A843" },
  { ticker: "ORAC", name: "Orange CI", country: "Côte d'Ivoire", sector: "Télécoms", flag: "🇨🇮",
    per: 10.2, mktcap: 390,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 12000, 2023: 14500, 2024: 15200, 2025: 15500, 2026: 15700 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 753, 2023: 780, 2024: 660, 2025: 660, 2026: 660 },
    color: "#FF6B35" },
  { ticker: "ONTBF", name: "ONATEL BF", country: "Burkina Faso", sector: "Télécoms", flag: "🇧🇫",
    per: 9.25, mktcap: 48,
    prices: { 2015: 1800, 2016: 1900, 2017: 2000, 2018: 2100, 2019: 2300, 2020: 2500, 2021: 2600, 2022: 2700, 2023: 2750, 2024: 2800, 2025: 2820, 2026: 2855 },
    dividends: { 2015: 100, 2016: 108, 2017: 115, 2018: 120, 2019: 132, 2020: 143, 2021: 155, 2022: 165, 2023: 175, 2024: 190, 2025: 190, 2026: 190 },
    color: "#14B8A6" },
  { ticker: "CBIBF", name: "Coris Bank BF", country: "Burkina Faso", sector: "Banques", flag: "🇧🇫",
    per: 8.5, mktcap: 320,
    prices: { 2015: 4000, 2016: 5000, 2017: 6500, 2018: 7500, 2019: 9000, 2020: 10500, 2021: 12000, 2022: 14500, 2023: 17000, 2024: 19500, 2025: 21000, 2026: 21465 },
    dividends: { 2015: 80, 2016: 100, 2017: 130, 2018: 160, 2019: 180, 2020: 200, 2021: 280, 2022: 350, 2023: 430, 2024: 555, 2025: 555, 2026: 555 },
    color: "#A855F7" },
  { ticker: "BOAB", name: "BOA Bénin", country: "Bénin", sector: "Banques", flag: "🇧🇯",
    per: 9.8, mktcap: 120,
    prices: { 2015: 2000, 2016: 2500, 2017: 3000, 2018: 3500, 2019: 3800, 2020: 4200, 2021: 5100, 2022: 6000, 2023: 7200, 2024: 8500, 2025: 8800, 2026: 8900 },
    dividends: { 2015: 80, 2016: 100, 2017: 120, 2018: 150, 2019: 175, 2020: 200, 2021: 270, 2022: 310, 2023: 380, 2024: 468, 2025: 468, 2026: 468 },
    color: "#F59E0B" },
  { ticker: "LNBB", name: "Loterie Nat. Bénin", country: "Bénin", sector: "Divertissement", flag: "🇧🇯",
    per: 8.3, mktcap: 45,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 3700, 2025: 3850, 2026: 3990 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 220, 2024: 275, 2025: 275, 2026: 275 },
    color: "#22C55E" },
  { ticker: "BICB", name: "BIIC Bénin", country: "Bénin", sector: "Banques", flag: "🇧🇯",
    per: 11.5, mktcap: 180,
    prices: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 5250, 2026: 5190 },
    dividends: { 2015: 0, 2016: 0, 2017: 0, 2018: 0, 2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 },
    color: "#EC4899" },
  { ticker: "SGBC", name: "SGB CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 9.8, mktcap: 590,
    prices: { 2015: 15000, 2016: 18000, 2017: 21000, 2018: 24000, 2019: 26000, 2020: 28000, 2021: 32000, 2022: 34000, 2023: 35000, 2024: 36500, 2025: 36000, 2026: 36600 },
    dividends: { 2015: 450, 2016: 550, 2017: 650, 2018: 750, 2019: 820, 2020: 900, 2021: 1100, 2022: 1400, 2023: 1646, 2024: 2293, 2025: 2293, 2026: 2293 },
    color: "#3B82F6" },
  { ticker: "NSBC", name: "NSIA Banque CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 11.2, mktcap: 280,
    prices: { 2015: 6000, 2016: 7500, 2017: 9000, 2018: 10500, 2019: 11500, 2020: 12000, 2021: 14000, 2022: 15500, 2023: 17000, 2024: 18000, 2025: 18000, 2026: 18000 },
    dividends: { 2015: 130, 2016: 170, 2017: 200, 2018: 240, 2019: 265, 2020: 290, 2021: 380, 2022: 470, 2023: 530, 2024: 668, 2025: 668, 2026: 668 },
    color: "#06B6D4" },
  { ticker: "ECOC", name: "Ecobank CI", country: "Côte d'Ivoire", sector: "Banques", flag: "🇨🇮",
    per: 10.1, mktcap: 195,
    prices: { 2015: 5500, 2016: 7000, 2017: 8500, 2018: 10000, 2019: 10500, 2020: 11000, 2021: 13000, 2022: 14500, 2023: 15500, 2024: 16200, 2025: 16300, 2026: 16300 },
    dividends: { 2015: 170, 2016: 220, 2017: 270, 2018: 320, 2019: 355, 2020: 380, 2021: 450, 2022: 530, 2023: 600, 2024: 708, 2025: 708, 2026: 708 },
    color: "#84CC16" },
  { ticker: "STBC", name: "SITAB CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 8.59, mktcap: 105,
    prices: { 2015: 6000, 2016: 7000, 2017: 8500, 2018: 9500, 2019: 10500, 2020: 12000, 2021: 15000, 2022: 18000, 2023: 19000, 2024: 20000, 2025: 21000, 2026: 21290 },
    dividends: { 2015: 320, 2016: 380, 2017: 460, 2018: 530, 2019: 600, 2020: 675, 2021: 900, 2022: 1200, 2023: 1500, 2024: 2096, 2025: 2096, 2026: 2096 },
    color: "#F97316" },
  { ticker: "SLBC", name: "Solibra CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 13.5, mktcap: 490,
    prices: { 2015: 18000, 2016: 20000, 2017: 23000, 2018: 25000, 2019: 27000, 2020: 30000, 2021: 34000, 2022: 36000, 2023: 37000, 2024: 38000, 2025: 38000, 2026: 38010 },
    dividends: { 2015: 400, 2016: 480, 2017: 560, 2018: 620, 2019: 660, 2020: 700, 2021: 800, 2022: 900, 2023: 950, 2024: 1074, 2025: 1074, 2026: 1074 },
    color: "#EAB308" },
  { ticker: "BOABF", name: "BOA Burkina", country: "Burkina Faso", sector: "Banques", flag: "🇧🇫",
    per: 9.13, mktcap: 80,
    prices: { 2015: 1500, 2016: 1800, 2017: 2200, 2018: 2600, 2019: 2900, 2020: 3200, 2021: 3800, 2022: 4400, 2023: 5000, 2024: 5300, 2025: 5500, 2026: 5500 },
    dividends: { 2015: 80, 2016: 100, 2017: 125, 2018: 155, 2019: 185, 2020: 220, 2021: 280, 2022: 320, 2023: 370, 2024: 428, 2025: 428, 2026: 428 },
    color: "#8B5CF6" },
  { ticker: "SDCC", name: "SODE CI", country: "Côte d'Ivoire", sector: "Services Publics", flag: "🇨🇮",
    per: 7.8, mktcap: 180,
    prices: { 2015: 3000, 2016: 3500, 2017: 4200, 2018: 5000, 2019: 5800, 2020: 6500, 2021: 7500, 2022: 8500, 2023: 9500, 2024: 10500, 2025: 11000, 2026: 11105 },
    dividends: { 2015: 90, 2016: 110, 2017: 135, 2018: 165, 2019: 195, 2020: 210, 2021: 260, 2022: 290, 2023: 352, 2024: 462, 2025: 462, 2026: 462 },
    color: "#10B981" },
  { ticker: "SDSC", name: "Africa Global Log.", country: "Côte d'Ivoire", sector: "Industrie", flag: "🇨🇮",
    per: 5.4, mktcap: 24,
    prices: { 2015: 600, 2016: 650, 2017: 700, 2018: 750, 2019: 820, 2020: 900, 2021: 1000, 2022: 1200, 2023: 1400, 2024: 1550, 2025: 1680, 2026: 1690 },
    dividends: { 2015: 15, 2016: 18, 2017: 22, 2018: 26, 2019: 30, 2020: 27, 2021: 34, 2022: 42, 2023: 50, 2024: 60, 2025: 60, 2026: 60 },
    color: "#F43F5E" },
  { ticker: "PALC", name: "Palm CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 9.2, mktcap: 115,
    prices: { 2015: 2200, 2016: 2600, 2017: 3200, 2018: 3800, 2019: 4200, 2020: 4500, 2021: 5500, 2022: 6500, 2023: 7000, 2024: 7500, 2025: 7800, 2026: 7800 },
    dividends: { 2015: 80, 2016: 100, 2017: 130, 2018: 165, 2019: 190, 2020: 200, 2021: 280, 2022: 330, 2023: 390, 2024: 442, 2025: 442, 2026: 442 },
    color: "#65A30D" },
  { ticker: "BOAN", name: "BOA Niger", country: "Niger", sector: "Banques", flag: "🇳🇪",
    per: 7.9, mktcap: 38,
    prices: { 2015: 1200, 2016: 1400, 2017: 1700, 2018: 2000, 2019: 2200, 2020: 2500, 2021: 2800, 2022: 3200, 2023: 3500, 2024: 3600, 2025: 3700, 2026: 3740 },
    dividends: { 2015: 45, 2016: 58, 2017: 72, 2018: 88, 2019: 98, 2020: 100, 2021: 130, 2022: 165, 2023: 190, 2024: 209, 2025: 209, 2026: 209 },
    color: "#0EA5E9" },
  { ticker: "TTLS", name: "TotalEnergies SN", country: "Sénégal", sector: "Énergie", flag: "🇸🇳",
    per: 8.8, mktcap: 42,
    prices: { 2015: 1400, 2016: 1600, 2017: 1800, 2018: 2000, 2019: 2100, 2020: 2200, 2021: 2500, 2022: 2800, 2023: 3000, 2024: 3100, 2025: 3200, 2026: 3200 },
    dividends: { 2015: 80, 2016: 95, 2017: 110, 2018: 125, 2019: 133, 2020: 140, 2021: 160, 2022: 185, 2023: 200, 2024: 222, 2025: 222, 2026: 222 },
    color: "#FB923C" },
  { ticker: "NTLC", name: "Nestle CI", country: "Côte d'Ivoire", sector: "Conso. Base", flag: "🇨🇮",
    per: 11.5, mktcap: 165,
    prices: { 2015: 5000, 2016: 6000, 2017: 7000, 2018: 8000, 2019: 8800, 2020: 9000, 2021: 10000, 2022: 11000, 2023: 12000, 2024: 13000, 2025: 13000, 2026: 13005 },
    dividends: { 2015: 200, 2016: 250, 2017: 300, 2018: 350, 2019: 380, 2020: 400, 2021: 500, 2022: 600, 2023: 675, 2024: 722, 2025: 722, 2026: 722 },
    color: "#A78BFA" },
  { ticker: "BOAS", name: "BOA Sénégal", country: "Sénégal", sector: "Banques", flag: "🇸🇳",
    per: 10.3, mktcap: 85,
    prices: { 2015: 2800, 2016: 3200, 2017: 3800, 2018: 4200, 2019: 4600, 2020: 5000, 2021: 5800, 2022: 6500, 2023: 7000, 2024: 7500, 2025: 7700, 2026: 7745 },
    dividends: { 2015: 70, 2016: 88, 2017: 108, 2018: 128, 2019: 140, 2020: 150, 2021: 200, 2022: 260, 2023: 310, 2024: 350, 2025: 350, 2026: 350 },
    color: "#34D399" },
];
