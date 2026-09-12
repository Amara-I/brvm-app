"use client";

import { featureFromPath, isAnalyticsFeature, shouldTrackPath, type AnalyticsFeature } from "@/lib/analytics/features";
import { isClientTrackingEnabled } from "@/lib/analytics/config";

const SESSION_KEY = "ouestbourse-analytics-sid";
const FLUSH_MS = 2500;
const MAX_BATCH = 20;

type QueuedEvent = {
  name: "page_view" | "nav_click" | "feature_click";
  feature: AnalyticsFeature;
  path: string;
  action?: string;
  sessionId: string;
};

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastPage: string | null = null;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
    const created = newSessionId();
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return newSessionId();
  }
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function enqueue(event: Omit<QueuedEvent, "sessionId" | "path"> & { path?: string }) {
  if (!isClientTrackingEnabled()) return;
  const path = event.path ?? currentPath();
  if (!shouldTrackPath(path)) return;
  const feature = isAnalyticsFeature(event.feature) ? event.feature : featureFromPath(path);
  queue.push({
    name: event.name,
    feature,
    path,
    action: event.action,
    sessionId: getSessionId(),
  });
  if (queue.length >= MAX_BATCH) {
    flushClientEvents();
    return;
  }
  if (timer == null) {
    timer = setTimeout(() => {
      timer = null;
      flushClientEvents();
    }, FLUSH_MS);
  }
}

export function flushClientEvents() {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ events: batch });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/events", blob);
      return;
    }
  } catch {
    // repli fetch
  }
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackPageView(path = currentPath()) {
  if (path === lastPage) return;
  lastPage = path;
  enqueue({ name: "page_view", feature: featureFromPath(path), path });
}

export function trackFeature(feature: AnalyticsFeature, action: string, path = currentPath()) {
  enqueue({ name: "feature_click", feature, action, path });
}

export function trackNav(feature: AnalyticsFeature, action = "nav", path = currentPath()) {
  enqueue({ name: "nav_click", feature, action, path });
}

export function trackFeatureClick(feature: string, action: string, path = currentPath()) {
  const resolved = isAnalyticsFeature(feature) ? feature : featureFromPath(path);
  const name = action.startsWith("nav") || action === "nav" ? "nav_click" : "feature_click";
  enqueue({ name, feature: resolved, action, path });
}
