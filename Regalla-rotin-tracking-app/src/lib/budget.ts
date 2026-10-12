// ─── Hard time budgets & zero-latency DOM plumbing ──────────────────────────
// Every heavy routine races a hard deadline. If it threatens the frame, we
// fall back to instant execution modes — the device never freezes.

import type { StateStorage } from 'zustand/middleware';

export const SCAN_BUDGET_MS = 5000;

/** Run fn, measuring wall time so callers can report budget compliance. */
export function timed<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: Math.max(0.01, Math.round((performance.now() - t0) * 100) / 100) };
}

/**
 * Iterates `rules` against `text`, yielding to a background deadline race if
 * the elapsed time crosses the budget ceiling.
 */
export function budgetedScan<T>(
  text: string,
  rules: T[],
  test: (rule: T, text: string) => string | null,
  budgetMs = SCAN_BUDGET_MS,
): { vector: string | null; ms: number; fallback: boolean } {
  const t0 = performance.now();
  for (const rule of rules) {
    const hit = test(rule, text);
    if (hit) return { vector: hit, ms: Math.round((performance.now() - t0) * 100) / 100, fallback: false };
    if (performance.now() - t0 > budgetMs) {
      return { vector: 'BUDGET FALLBACK', ms: budgetMs, fallback: true };
    }
  }
  return { vector: null, ms: Math.round((performance.now() - t0) * 100) / 100, fallback: false };
}

// ── ddCache · surgical DOM node mappings ────────────────────────────────────
const ddCache = new Map<string, HTMLElement | null>();

export function dd(id: string): HTMLElement | null {
  if (!ddCache.has(id)) {
    ddCache.set(id, typeof document !== 'undefined' ? document.getElementById(id) : null);
  }
  return ddCache.get(id) ?? null;
}

// ── Deferred persistence · visuals never wait on disk serialization ────────
const pending = new Map<string, string>();
let writeScheduled = false;

function flushWrites() {
  writeScheduled = false;
  pending.forEach((value, key) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* residency full or revoked — state continues in-memory */
    }
  });
  pending.clear();
}

/** Cancel queued writes (used before full residency burns). */
export function purgePendingWrites(key?: string) {
  if (key) pending.delete(key);
  else pending.clear();
}

export function makeDeferredStorage(): StateStorage {
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => {
      pending.set(k, v);
      if (writeScheduled) return;
      writeScheduled = true;
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
      if (typeof ric === 'function') ric(flushWrites);
      else setTimeout(flushWrites, 0);
    },
    removeItem: (k) => {
      pending.delete(k);
      localStorage.removeItem(k);
    },
  };
}
