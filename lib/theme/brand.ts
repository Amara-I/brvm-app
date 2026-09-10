// ═══════════════════════════════════════════════════════════════════════════
// Identité de marque — rebranding complet du 09/08/2026
// ═══════════════════════════════════════════════════════════════════════════
// Décision explicite de l'utilisateur (09/08/2026) : "OuestBourse" est SA
// propre marque (nom + logo, propriété confirmée par l'utilisateur avant
// implémentation — cf. AGENTS.md § Étape 11). Le nom et le logo sont donc
// utilisés PARTOUT dans l'application (landing + toutes les pages internes),
// en remplacement de "BRVM App".
//
// Graphie validée : « O » majuscule — "OuestBourse" (pas "ouestBourse").
//
// Source de vérité unique pour le nom/logo affiché : ne jamais coder en dur
// "BRVM App" ou un chemin de logo ailleurs — importer depuis ce fichier.
// ═══════════════════════════════════════════════════════════════════════════

export const BRAND_NAME = "OuestBourse";
export const BRAND_NAME_PART_1 = "Ouest";
export const BRAND_NAME_PART_2 = "Bourse";
export const BRAND_TAGLINE = "West Africa's Stock Market";
export const BRAND_LOGO_SRC = "/logo.png";
export const BRAND_LOGO_WIDTH = 1478;
export const BRAND_LOGO_HEIGHT = 366;

/** Hauteurs d'affichage UI — calées sur l'échelle typographique (≈ ×1,33 vs. taille d'origine). */
export const BRAND_LOGO_HEIGHT_SIDEBAR = 56;
export const BRAND_LOGO_HEIGHT_TOPBAR = 46;
