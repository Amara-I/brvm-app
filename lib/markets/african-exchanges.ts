// Catalogues des marchés africains proposés sur /marche (étape 18).
// Seule la BRVM a des données live pour l'instant ; les autres sont
// listés honnêtement (état "bientôt") sans chiffres inventés.

export type AfricanExchangeCode =
  | "BRVM"
  | "BVMAC"
  | "NGX"
  | "NSE"
  | "JSE"
  | "GSE"
  | "TSE";

export interface AfricanExchange {
  code: AfricanExchangeCode;
  name: string;
  shortLabel: string;
  region: string;
  currency: string;
  /** true = positions + indices branchés sur la base OuestBourse. */
  live: boolean;
  headlineIndexHints: string[];
}

export const AFRICAN_EXCHANGES: AfricanExchange[] = [
  {
    code: "BRVM",
    name: "BRVM — Bourse Régionale des Valeurs Mobilières",
    shortLabel: "BRVM",
    region: "UEMOA (Afrique de l'Ouest)",
    currency: "FCFA",
    live: true,
    headlineIndexHints: ["BRVM Composite", "BRVM 30"],
  },
  {
    code: "BVMAC",
    name: "BVMAC — Bourse des Valeurs Mobilières d'Afrique Centrale",
    shortLabel: "BVMAC",
    region: "CEMAC",
    currency: "FCFA",
    live: false,
    headlineIndexHints: ["BVMAC Composite"],
  },
  {
    code: "NGX",
    name: "NGX — Nigerian Exchange",
    shortLabel: "NGX",
    region: "Nigeria",
    currency: "NGN",
    live: false,
    headlineIndexHints: ["NGX All-Share"],
  },
  {
    code: "NSE",
    name: "NSE — Nairobi Securities Exchange",
    shortLabel: "NSE",
    region: "Kenya",
    currency: "KES",
    live: false,
    headlineIndexHints: ["NSE All-Share"],
  },
  {
    code: "JSE",
    name: "JSE — Johannesburg Stock Exchange",
    shortLabel: "JSE",
    region: "Afrique du Sud",
    currency: "ZAR",
    live: false,
    headlineIndexHints: ["JSE All Share"],
  },
  {
    code: "GSE",
    name: "GSE — Ghana Stock Exchange",
    shortLabel: "GSE",
    region: "Ghana",
    currency: "GHS",
    live: false,
    headlineIndexHints: ["GSE Composite"],
  },
  {
    code: "TSE",
    name: "TSE — Tunis Stock Exchange",
    shortLabel: "TSE",
    region: "Tunisie",
    currency: "TND",
    live: false,
    headlineIndexHints: ["TUNINDEX"],
  },
];

export const DEFAULT_EXCHANGE_CODE: AfricanExchangeCode = "BRVM";

export function getExchange(code: AfricanExchangeCode): AfricanExchange {
  return AFRICAN_EXCHANGES.find((e) => e.code === code) ?? AFRICAN_EXCHANGES[0]!;
}
