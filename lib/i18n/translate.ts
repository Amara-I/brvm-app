export type TranslateVars = Record<string, string | number | null | undefined>;

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export type DeepStringTree<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringTree<T[K]>;
};

export type DotPaths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
    }[keyof T & string];

export function readPath(tree: unknown, path: string): string | null {
  let current: unknown = tree;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}

export function createTranslator<T>(messages: T) {
  function t(path: DotPaths<T>, vars?: TranslateVars): string {
    const value = readPath(messages, path as string);
    if (value == null) return path as string;
    return interpolate(value, vars);
  }
  return t;
}
