import type { StatementImportCode } from "./types";

/** 4 Mo : sous la limite de corps des fonctions Vercel (4,5 Mo). */
export const STATEMENT_MAX_BYTES = 4_000_000;

export const STATEMENT_MAX_ROWS = 200;

export const STATEMENT_ERRORS: Record<StatementImportCode, string> = {
  EMPTY: "Le fichier est vide.",
  TOO_LARGE: "Fichier trop volumineux (maximum 4 Mo).",
  UNSUPPORTED:
    "Format non accepté. Déposez un PDF, un fichier Excel (.xlsx ou .xls), un CSV, ou une image JPEG, PNG ou WEBP.",
  INVALID_PDF: "Ce fichier n’est pas un PDF valide.",
  SCANNED_PDF:
    "Ce PDF ne contient pas de texte sélectionnable (scan ou photo). Déposez une image JPEG, PNG ou WEBP : elle sera lue par OCR. Un PDF image peut aussi être lu directement si la clé de vision AI_GATEWAY_API_KEY est configurée.",
  HEIC: "Les photos HEIC / HEIF ne sont pas lues. Enregistrez-les en JPEG ou PNG, puis déposez-les à nouveau.",
  UNRECOGNIZED:
    "Aucune ligne de position n’a été reconnue. Le fichier doit indiquer au moins le titre (code ou nom de la société) et la quantité. Les relevés au format très spécifique pourront être pris en charge dès qu’un exemple anonymisé sera disponible.",
  UNREADABLE:
    "Lecture du fichier impossible. Vérifiez qu’il n’est pas protégé par un mot de passe, puis réessayez.",
};

export class StatementImportError extends Error {
  readonly code: StatementImportCode;

  constructor(code: StatementImportCode, message = STATEMENT_ERRORS[code]) {
    super(message);
    this.name = "StatementImportError";
    this.code = code;
  }
}

export function statementErrorStatus(code: StatementImportCode): number {
  if (code === "SCANNED_PDF" || code === "UNRECOGNIZED" || code === "UNREADABLE") return 422;
  return 400;
}
