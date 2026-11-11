// Ligne du tableau « vue d'ensemble » NGX, partagée entre le chargement serveur
// et le composant client. Aucune valeur inventée : null = N/D à l'affichage.

import type { NgxSparkPacked } from "@/lib/markets/ngx-spark";
import type { NgxScoreMode } from "@/lib/ngx/score";
import type { NgxOverviewConfidence, NgxSignal } from "@/lib/ngx/signal";

export interface NgxBoardRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorLabel: string;
  /** Dernier cours en naira, null = N/D. */
  close: number | null;
  /** Variation du jour (%), null = N/D. */
  changePercent: number | null;
  /** Capitalisation en milliards de naira, null = N/D. */
  marketCapBn: number | null;
  /** Cours FCFA indicatif, null = N/D. */
  fcfa: number | null;
  /** Variation sur 1 an (%), null = N/D. */
  return1yPercent: number | null;
  /** Rendement du dividende (%), pour le KPI marché uniquement — pas une colonne du tableau. */
  yieldPercent?: number | null;
  /** Série d'aperçu compactée, null = N/D. */
  spark: NgxSparkPacked | null;
  /** Note globale /100, null = N/D. */
  score: number | null;
  scoreMode: NgxScoreMode | null;
  /** Signal technique (lib/ngx/technical-signal.ts), indépendant de la note. */
  signal: NgxSignal | null;
  confidence: NgxOverviewConfidence | null;
  /** Titre peu liquide (analyse technique) : confiance basse. */
  illiquid?: boolean;
}
