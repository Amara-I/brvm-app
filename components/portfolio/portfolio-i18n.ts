import type { FormatApi } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { STATEMENT_ERRORS } from "@/lib/portfolio/sgi-statement/messages";
import type { IgnoreReason, StatementImportCode } from "@/lib/portfolio/sgi-statement/types";
import type { DiscreteMaskKey } from "@/lib/portfolio/discrete-mode";

export function isoLocalDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year || 0, (month || 1) - 1, day || 1);
}

export function formatIso(
  format: FormatApi,
  iso: string | null | undefined,
  withYear = true
): string {
  if (!iso || iso === "N/D") return "N/D";
  return format.date(
    isoLocalDate(iso),
    withYear
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : { day: "2-digit", month: "2-digit" }
  );
}

export function statementErrorText(t: TFunc, code: string): string | null {
  switch (code) {
    case "EMPTY":
      return t("portfolio.statement.errors.EMPTY");
    case "TOO_LARGE":
      return t("portfolio.statement.errors.TOO_LARGE");
    case "UNSUPPORTED":
      return t("portfolio.statement.errors.UNSUPPORTED");
    case "INVALID_PDF":
      return t("portfolio.statement.errors.INVALID_PDF");
    case "SCANNED_PDF":
      return t("portfolio.statement.errors.SCANNED_PDF");
    case "HEIC":
      return t("portfolio.statement.errors.HEIC");
    case "UNRECOGNIZED":
      return t("portfolio.statement.errors.UNRECOGNIZED");
    case "UNREADABLE":
      return t("portfolio.statement.errors.UNREADABLE");
    default:
      return null;
  }
}

export function errorFromPayload(t: TFunc, json: { error?: unknown; details?: { code?: unknown } } | null, fallback: string): string {
  const code = json?.details && typeof json.details === "object" ? json.details.code : undefined;
  if (typeof code === "string") {
    const translated = statementErrorText(t, code);
    if (translated) return translated;
  }
  return showPortfolioApiError(t, json?.error, fallback);
}

export function showPortfolioApiError(t: TFunc, raw: unknown, fallback: string): string {
  const message = typeof raw === "string" ? raw : "";
  if (!message) return fallback;
  const code = (Object.keys(STATEMENT_ERRORS) as StatementImportCode[]).find(
    (key) => STATEMENT_ERRORS[key] === message
  );
  if (code) return statementErrorText(t, code) ?? message;

  switch (message) {
    case "Authentification requise":
      return t("portfolio.api.authRequired");
    case "Corps multipart attendu (champ « file »).":
      return t("portfolio.api.multipart");
    case "Fichier manquant (champ « file »).":
      return t("portfolio.api.fileMissing");
    case "Fichier vide.":
      return t("portfolio.api.fileEmpty");
    case "Fichier trop volumineux (max. 1,5 Mo).":
      return t("portfolio.api.tooLargeExcel");
    case "Format attendu : .xlsx (Excel).":
      return t("portfolio.api.xlsxOnly");
    case "Aucune position valide à importer.":
      return t("portfolio.api.noValidRows");
    case "La base ne suit pas encore les obligations et FCP. Appliquez la migration, puis réessayez.":
      return t("portfolio.api.otherHoldings");
    case "Indiquez un prix de vente (cours actuel indisponible)":
      return t("portfolio.api.sellPriceMissing");
    case "Date du relevé invalide.":
      return t("portfolio.api.badStatementDate");
    case "Date d’achat invalide.":
      return t("portfolio.api.badBuyDate");
    case "Aucune ligne exploitable : indiquez une quantité et un prix pour chaque ligne retenue.":
      return t("portfolio.api.noUsableRows");
    case "Une ou plusieurs sociétés ne sont plus reconnues. Relancez l’analyse du relevé.":
      return t("portfolio.api.companiesStale");
    case "Paramètres invalides":
      return t("portfolio.api.invalidParams");
    case "Aucune modification":
      return t("portfolio.api.noChange");
    case "Indiquez soit quantitySold (vente), soit quantity (correction), pas les deux":
      return t("portfolio.api.bothQty");
    case "En-têtes requis manquants : Ticker, Quantité, PRU (FCFA). Exportez d'abord un modèle depuis OuestBourse.":
      return t("portfolio.api.excelHeaders");
    default: {
      const sold = message.match(/^Quantité vendue \((.+)\) supérieure à la position \((.+)\)$/);
      if (sold) return t("portfolio.api.qtySold", { sold: sold[1], qty: sold[2] });
      const tickers = message.match(/^Aucun ticker reconnu parmi : (.+)\.$/);
      if (tickers) return t("portfolio.api.noTicker", { list: tickers[1] });
      const truncated = message.match(/^Seules les (\d+) premières lignes ont été lues\.$/);
      if (truncated) return t("portfolio.api.excelTruncated", { count: truncated[1] });
      const missingTicker = message.match(/^Ligne (\d+) : ticker manquant\.$/);
      if (missingTicker) return t("portfolio.api.excelTicker", { line: missingTicker[1] });
      const qty = message.match(/^Ligne (\d+) \((.+)\) : quantité invalide\.$/);
      if (qty) return t("portfolio.api.excelQty", { line: qty[1], ticker: qty[2] });
      const pru = message.match(/^Ligne (\d+) \((.+)\) : PRU invalide\.$/);
      if (pru) return t("portfolio.api.excelPru", { line: pru[1], ticker: pru[2] });
      const dup = message.match(/^Ligne (\d+) \((.+)\) : ticker en double — ligne ignorée\.$/);
      if (dup) return t("portfolio.api.excelDup", { line: dup[1], ticker: dup[2] });
      const date = message.match(/^Ligne (\d+) \((.+)\) : date d'achat invalide — ignorée\.$/);
      if (date) return t("portfolio.api.excelDate", { line: date[1], ticker: date[2] });
      return message;
    }
  }
}

export function localizeQuoteLabel(label: string, locale: Locale, t: TFunc, format: FormatApi): string {
  if (!label || label === "N/D") return label || "N/D";
  if (locale !== "en") return label;
  const one = label.match(/^Cours au (\d{2})\/(\d{2})\/(\d{4})$/);
  if (one) {
    const date = new Date(Number(one[3]), Number(one[2]) - 1, Number(one[1]));
    return t("portfolio.kpis.priceOn", { date: format.date(date) });
  }
  const range = label.match(/^Cours du (\d{2})\/(\d{2})\/(\d{4}) au (\d{2})\/(\d{2})\/(\d{4})$/);
  if (range) {
    const from = new Date(Number(range[3]), Number(range[2]) - 1, Number(range[1]));
    const to = new Date(Number(range[6]), Number(range[5]) - 1, Number(range[4]));
    return t("portfolio.kpis.priceRange", { from: format.date(from), to: format.date(to) });
  }
  return label;
}

export function localizeBasisLabel(label: string, t: TFunc): string {
  switch (label) {
    case "Prix d'achat":
      return t("portfolio.other.basis.purchase");
    case "Dernier prix connu":
      return t("portfolio.other.basis.latest");
    case "Prix d'achat (% du nominal)":
      return t("portfolio.other.basis.purchasePct");
    case "Dernier prix connu (% du nominal)":
      return t("portfolio.other.basis.latestPct");
    case "VL d'achat":
      return t("portfolio.other.basis.navPurchase");
    case "VL saisie":
      return t("portfolio.other.basis.navLatest");
    case "Coupon couru depuis l'achat (base 365 j, sans calendrier de détachement)":
      return t("portfolio.other.basis.accrued");
    default:
      return label;
  }
}

export function localizeAssetType(type: string, t: TFunc): string {
  if (type === "Actions") return t("portfolio.asset.shares");
  if (type === "Obligations") return t("portfolio.asset.bonds");
  if (type === "FCP") return t("portfolio.asset.fcp");
  return type;
}

export function discreteMaskLabel(key: DiscreteMaskKey, t: TFunc): string {
  switch (key) {
    case "quantity":
      return t("portfolio.discrete.masks.quantity");
    case "pru":
      return t("portfolio.discrete.masks.pru");
    case "cost":
      return t("portfolio.discrete.masks.cost");
    case "portfolioTotal":
      return t("portfolio.discrete.masks.portfolioTotal");
    case "positionTotal":
      return t("portfolio.discrete.masks.positionTotal");
    case "unitPrice":
      return t("portfolio.discrete.masks.unitPrice");
    case "gainAmount":
      return t("portfolio.discrete.masks.gainAmount");
    case "gainPercent":
      return t("portfolio.discrete.masks.gainPercent");
    case "realizedPnl":
      return t("portfolio.discrete.masks.realizedPnl");
    case "tradeAmounts":
      return t("portfolio.discrete.masks.tradeAmounts");
    case "navChart":
      return t("portfolio.discrete.masks.navChart");
    case "allocationAmounts":
      return t("portfolio.discrete.masks.allocationAmounts");
  }
}

export function ignoreReasonLabel(reason: IgnoreReason, t: TFunc): string {
  switch (reason) {
    case "vide":
      return t("portfolio.statement.ignore.vide");
    case "en-tete":
      return t("portfolio.statement.ignore.enTete");
    case "adresse":
      return t("portfolio.statement.ignore.adresse");
    case "page":
      return t("portfolio.statement.ignore.page");
    case "disclaimer":
      return t("portfolio.statement.ignore.disclaimer");
    case "especes":
      return t("portfolio.statement.ignore.especes");
    case "frais":
      return t("portfolio.statement.ignore.frais");
    case "total":
      return t("portfolio.statement.ignore.total");
    case "section":
      return t("portfolio.statement.ignore.section");
    case "sans-instrument":
      return t("portfolio.statement.ignore.sansInstrument");
    case "soldee":
      return t("portfolio.statement.ignore.soldee");
    case "couverte":
      return t("portfolio.statement.ignore.couverte");
  }
}

/** Parser notes stay byte-identical in French. English maps known sentences. */
export function localizeStatementNote(text: string, locale: Locale, t: TFunc): string {
  if (locale !== "en") return text;
  switch (text) {
    case "Quantité manquante ou invalide.":
      return t("portfolio.statement.notes.missingQty");
    case "PRU manquant — à compléter avant l’enregistrement.":
      return t("portfolio.statement.notes.missingPru");
    case "Aucune société cotée ne correspond à cette ligne.":
      return t("portfolio.statement.notes.noCompany");
    case "Plusieurs sociétés possibles — vérifiez le titre.":
      return t("portfolio.statement.notes.ambiguous");
    case "La valorisation s’écarte de quantité × cours.":
      return t("portfolio.statement.notes.valuation");
    case "Le libellé contredit la colonne Débit ou Crédit — vérifiez le sens.":
      return t("portfolio.statement.notes.side");
    case "Obligation ou FCP : le nom est repris du relevé, sans rapprochement avec une action cotée.":
      return t("portfolio.statement.notes.otherInstrument");
    case "Relevé de mouvements de titres":
      return t("portfolio.statement.notes.layoutMoves");
    case "Relevé de positions":
      return t("portfolio.statement.notes.layoutPositions");
    case "Une position par titre":
      return t("portfolio.statement.notes.layoutOne");
    case "Historique et positions":
      return t("portfolio.statement.notes.layoutHistory");
    case "Tableau à colonnes":
      return t("portfolio.statement.notes.layoutColumns");
    case "Blocs libellé / valeur":
      return t("portfolio.statement.notes.layoutBlocks");
    case "Lignes libres":
      return t("portfolio.statement.notes.layoutLoose");
    case "Fichier tabulé":
      return t("portfolio.statement.notes.layoutTable");
    case "Société choisie manuellement.":
      return t("portfolio.statement.chosen");
    case "Aucune société choisie.":
      return t("portfolio.statement.noneChosen");
    default: {
      const unmatched = text.match(/^(\d+) ligne\(s\) sans société reconnue — à corriger ou à exclure\.$/);
      if (unmatched) return t("portfolio.statement.notes.unmatched", { count: unmatched[1] });
      const ambiguous = text.match(/^(\d+) ligne\(s\) avec plusieurs correspondances possibles\.$/);
      if (ambiguous) return t("portfolio.statement.notes.ambiguousRows", { count: ambiguous[1] });
      const missing = text.match(/^(\d+) ligne\(s\) sans PRU — à compléter avant l’enregistrement\.$/);
      if (missing) return t("portfolio.statement.notes.missingPruRows", { count: missing[1] });
      const duplicates = text.match(
        /^Certaines valeurs apparaissent plusieurs fois \((.+)\) — les quantités cochées seront additionnées à l’enregistrement\.$/
      );
      if (duplicates) return t("portfolio.statement.notes.duplicates", { list: duplicates[1] });
      const truncated = text.match(/^Seules les (\d+) premières lignes ont été conservées\.$/);
      if (truncated) return t("portfolio.statement.notes.truncated", { count: truncated[1] });
      const incomplete = text.match(
        /^Mouvements incomplets : la quantité (.+) est reprise du solde d'en-tête, le PRU est inconnu\.$/
      );
      if (incomplete) return t("portfolio.statement.notes.incomplete", { qty: incomplete[1] });
      const balance = text.match(
        /^Le solde du relevé \((.+)\) ne correspond pas à la quantité calculée \((.+)\)\.$/
      );
      if (balance) return t("portfolio.statement.notes.balance", { expected: balance[1], computed: balance[2] });
      const confidence = text.match(
        /^Confiance (haute|moyenne|faible|aucune) : (code ISIN|code valeur|alias SGI|nom de la société|nom approché|aucune correspondance) vers( [A-Z0-9]+)?\. (Quantité nette et PRU pondéré, solde du relevé confirmé\.|Quantité nette et PRU pondéré des opérations\.|Quantité lue sur le relevé de positions\.)$/
      );
      if (confidence) {
        const level =
          confidence[1] === "haute"
            ? t("portfolio.statement.notes.levelHigh")
            : confidence[1] === "moyenne"
              ? t("portfolio.statement.notes.levelMid")
              : confidence[1] === "faible"
                ? t("portfolio.statement.notes.levelLow")
                : t("portfolio.statement.notes.levelNone");
        const via =
          confidence[2] === "code ISIN"
            ? t("portfolio.statement.notes.viaIsin")
            : confidence[2] === "code valeur"
              ? t("portfolio.statement.notes.viaTicker")
              : confidence[2] === "alias SGI"
                ? t("portfolio.statement.notes.viaAlias")
                : confidence[2] === "nom de la société"
                  ? t("portfolio.statement.notes.viaName")
                  : confidence[2] === "nom approché"
                    ? t("portfolio.statement.notes.viaFuzzy")
                    : t("portfolio.statement.notes.viaNone");
        const sentence =
          confidence[4] === "Quantité nette et PRU pondéré, solde du relevé confirmé."
            ? t("portfolio.statement.notes.sentenceMoves")
            : confidence[4] === "Quantité nette et PRU pondéré des opérations."
              ? t("portfolio.statement.notes.sentenceOps")
              : t("portfolio.statement.notes.sentencePositions");
        return t("portfolio.statement.notes.confidence", {
          level,
          via,
          ticker: confidence[3] ?? "",
          sentence,
        });
      }
      return text;
    }
  }
}
