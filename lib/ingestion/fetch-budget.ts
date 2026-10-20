// Délai absolu partagé par les fetch d'un run d'ingestion (AsyncLocalStorage :
// pas besoin de le faire passer dans chaque signature de connecteur).
// Sans ça, un retry 15s × 3 + Crawl-delay peut dépasser le kill Vercel à 300s.

import { AsyncLocalStorage } from "node:async_hooks";

const ATTEMPT_RESERVE_MS = 250;
const MIN_ATTEMPT_MS = 500;

interface DeadlineStore {
  deadlineMs: number;
}

const storage = new AsyncLocalStorage<DeadlineStore>();

/// Borne le timeout d'une tentative. `null` = ne pas démarrer (plus assez de temps).
export function capAttemptTimeout(requestedMs: number, remainingMs: number | null): number | null {
  if (remainingMs == null) return requestedMs;
  const usable = remainingMs - ATTEMPT_RESERVE_MS;
  if (usable < MIN_ATTEMPT_MS) return null;
  return Math.min(requestedMs, usable);
}

export function runWithFetchDeadline<T>(deadlineMs: number, fn: () => Promise<T>): Promise<T> {
  return storage.run({ deadlineMs }, fn);
}

export function fetchDeadlineRemainingMs(now = Date.now()): number | null {
  const store = storage.getStore();
  if (!store) return null;
  return store.deadlineMs - now;
}

export function isFetchDeadlineExceeded(minMs = 750, now = Date.now()): boolean {
  const left = fetchDeadlineRemainingMs(now);
  return left !== null && left < minMs;
}

export function isIngestBudgetError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Budget temps");
}
