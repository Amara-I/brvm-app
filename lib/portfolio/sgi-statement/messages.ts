import type { StatementImportCode } from "./types";

/** 4 Mo : sous la limite de corps des fonctions Vercel (4,5 Mo). */
export const STATEMENT_MAX_BYTES = 4_000_000;

export const STATEMENT_MAX_ROWS = 200;

export const STATEMENT_ERRORS: Record<StatementImportCode, string> = {
  EMPTY: "Le fichier est vide.",
  TOO_LARGE: "Fichier trop volumineux (maximum 4 Mo).",
  UNSUPPORTED: "Format non accepté. Déposez un PDF, un fichier Excel (.xlsx ou .xls) ou un CSV.",
  INVALID_PDF: "Ce fichier n’est pas un PDF valide.",
  SCANNED_PDF:
    "Ce PDF ne contient pas de couche de texte exploitable (document scanné, image, ou texte incomplet). L’import ne peut pas en extraire les positions. Demandez à votre SGI un relevé PDF « texte » ou un export Excel/CSV. La reconnaissance optique (OCR) sera proposée dans une prochaine version.",
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
