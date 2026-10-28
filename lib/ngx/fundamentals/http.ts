// Client HTTP poli pour doclib.ngxgroup.com : un en-tête de navigateur, ~1 requête/s, nouvelles tentatives.

export const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let lastRequestAt = 0;

export async function politeDelay(minGapMs = 1100): Promise<void> {
  const wait = lastRequestAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export async function politeFetch(
  url: string,
  init: RequestInit & { retries?: number; minGapMs?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const { retries = 3, minGapMs = 1100, timeoutMs = 120_000, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeDelay(minGapMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { "User-Agent": BROWSER_UA, ...(rest.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`fetch failed after retries: ${url} (${String(lastErr)})`);
}
