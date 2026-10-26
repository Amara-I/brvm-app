import type { TFunc } from "@/lib/i18n/create-i18n";
import type { IndexFamily } from "@/lib/markets/index-catalog";

export function translateIndexFamily(family: IndexFamily, t: TFunc): string {
  if (family === "principal") return t("market.indices.family.principal");
  if (family === "sectoriel") return t("market.indices.family.sectoriel");
  return t("market.indices.family.autre");
}

export function translateIndexDescription(
  code: string,
  description: string,
  t: TFunc,
  sector: (name: string) => string
): string {
  switch (code.toUpperCase()) {
    case "BRVM_COMPOSITE":
      return t("market.indices.desc.composite");
    case "BRVM_30":
      return t("market.indices.desc.brvm30");
    case "BRVM_PRESTIGE":
      return t("market.indices.desc.prestige");
    case "BRVM_PRINCIPAL":
      return t("market.indices.desc.principal");
    case "BRVM_COMPOSITE_TOTAL_RETURN":
      return t("market.indices.desc.compositeTr");
    case "SIKA_TOTAL_RETURN":
      return t("market.indices.desc.sikaTr");
    case "INDICE_SIKAFINANCE":
      return t("market.indices.desc.sika");
    default:
      break;
  }

  const sectorMatch = description.match(
    /^Indice sectoriel BRVM\. Sociétés classées « (.+) » en base — pondérations officielles N\/D\.$/
  );
  if (sectorMatch?.[1]) {
    return t("market.indices.desc.sector", { sector: sector(sectorMatch[1]) });
  }
  if (description === "Indice principal BRVM. Composition officielle N/D en base.") {
    return t("market.indices.desc.principalFallback");
  }
  if (description === "Indice BRVM suivi en base. Composition officielle N/D.") {
    return t("market.indices.desc.brvmFallback");
  }
  if (description === "Indice suivi en base. Composition officielle non disponible.") {
    return t("market.indices.desc.other");
  }
  return description;
}

export function translateCompositionNote(
  note: string,
  t: TFunc,
  sector: (name: string) => string
): string {
  const avis = note.match(
    /^Avis (.+) — liste officielle \(repli documenté\)\. Pondérations individuelles N\/D\.$/
  );
  if (avis?.[1]) return t("market.indices.note.avis", { avis: avis[1] });

  const dated = note.match(/^Composition officielle BRVM au (.+)\. Pondérations individuelles N\/D\.$/);
  if (dated?.[1]) return t("market.indices.note.officialDated", { date: dated[1] });

  if (note === "Composition officielle BRVM. Pondérations individuelles N/D.") {
    return t("market.indices.note.official");
  }
  if (note === "Composition officielle non disponible en base.") {
    return t("market.indices.note.unavailable");
  }
  if (
    note ===
    "Univers de cote : toutes les sociétés actives suivies en base. Pondérations officielles N/D."
  ) {
    return t("market.indices.note.universe");
  }

  const peers = note.match(
    /^Sociétés du secteur « (.+) » en base — ce n’est pas la composition officielle pondérée\. Pondérations N\/D\.$/
  );
  if (peers?.[1]) return t("market.indices.note.peers", { sector: sector(peers[1]) });
  return note;
}
