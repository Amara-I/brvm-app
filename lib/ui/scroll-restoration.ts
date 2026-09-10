const SCROLL_PREFIX = "ouestbourse:scroll:";

export function pageScrollKey(pathname: string, search = ""): string {
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function saveScrollPosition(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_PREFIX + key, String(window.scrollY));
  } catch {
    // sessionStorage indisponible (mode privé, quota…)
  }
}

export function readScrollPosition(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCROLL_PREFIX + key);
    if (raw == null) return null;
    const y = Number(raw);
    return Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

/** Restaure le scroll ; plusieurs tentatives pour attendre le rendu asynchrone. */
export function restoreScrollPosition(key: string): void {
  const y = readScrollPosition(key);
  if (y == null) return;

  const apply = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });

  apply();
  requestAnimationFrame(apply);
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
  window.setTimeout(apply, 350);
}

/** Exécute une action async sans perdre la position de scroll. */
export async function preserveScrollDuring(fn: () => Promise<void>): Promise<void> {
  const y = typeof window !== "undefined" ? window.scrollY : 0;
  await fn();
  if (typeof window === "undefined") return;
  const restore = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });
  restore();
  requestAnimationFrame(restore);
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 100);
}

export function isBrowserReload(): boolean {
  if (typeof window === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}
