/** Libellés UI des sources (jamais de chiffre inventé). */
export function dataSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "BRVM_OFFICIEL":
      return "BRVM officiel";
    case "SIKAFINANCE":
      return "Sikafinance";
    case "OUESTBOURSE":
      return "OuestBourse.com";
    case "RICHBOURSE":
      return "Richbourse";
    case "MANUEL":
      return "Saisie manuelle";
    default:
      return source && source.trim() ? source : "N/D";
  }
}
