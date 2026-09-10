// Helpers de lecture de tableaux HTML — matching d'en-têtes plutôt que
// d'indices de colonnes figés (les sites sources ajoutent/réordonnent
// souvent une colonne sans prévenir).

export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function findHeaderIndex(headers: string[], matchers: Array<string | RegExp>): number {
  const norms = headers.map(normalizeHeader);
  for (const matcher of matchers) {
    const idx = norms.findIndex((h) => (typeof matcher === "string" ? h.includes(matcher) : matcher.test(h)));
    if (idx >= 0) return idx;
  }
  return -1;
}
