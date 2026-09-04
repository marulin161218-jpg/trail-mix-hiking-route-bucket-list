// Storage layer. loadTrails and saveTrails are independent: neither calls the
// other, and each owns its own try/catch.

import { normalizeTrail, type Trail } from './domain';

export const KEY = 'trailmix-data';

export type LoadResult = {
  trails: Trail[];
  /** Stored entries that could not be normalized. */
  failed: number;
  /** Stored entries found, valid or not. */
  total: number;
  /** Record unreadable: not JSON, not an array, or getItem threw. */
  corrupt: boolean;
};

export type SaveResult = { ok: true } | { ok: false; reason: 'write' };

export function loadTrails(): LoadResult {
  const unreadable: LoadResult = { trails: [], failed: 1, total: 1, corrupt: true };
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return unreadable;
  }
  if (!raw) return { trails: [], failed: 0, total: 0, corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unreadable;
  }
  if (!Array.isArray(parsed)) return unreadable;

  const now = Date.now();
  const trails: Trail[] = [];
  parsed.forEach((entry, i) => {
    const trail = normalizeTrail(entry, now, `t${now}-${i}`);
    if (trail) trails.push(trail);
  });
  return { trails, failed: parsed.length - trails.length, total: parsed.length, corrupt: false };
}

export function saveTrails(trails: readonly Trail[]): SaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify(trails));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'write' };
  }
}
