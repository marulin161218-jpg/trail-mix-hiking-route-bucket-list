import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY, loadTrails, saveTrails } from './storage';
import type { Trail } from './domain';

const store = new Map<string, string>();
let readError: Error | null = null;
let writeError: Error | null = null;

vi.stubGlobal('localStorage', {
  getItem: (k: string) => {
    if (readError) throw readError;
    return store.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (writeError) throw writeError;
    store.set(k, v);
  },
});

const valid: Trail = {
  id: 'a', name: 'Rinjani via Sembalun', location: 'Lombok Timur, NTB', distance: 12.4,
  unit: 'km', difficulty: 'hard', notes: '', status: 'want', createdAt: 1,
};

beforeEach(() => {
  store.clear();
  readError = null;
  writeError = null;
});

describe('loadTrails', () => {
  it('is empty when nothing is stored', () => {
    expect(loadTrails()).toEqual({ trails: [], failed: 0, total: 0, corrupt: false });
  });

  it('flags a record that is not valid JSON', () => {
    store.set(KEY, '{bukan json[');
    expect(loadTrails()).toEqual({ trails: [], failed: 1, total: 1, corrupt: true });
  });

  it('flags a record that is not an array', () => {
    store.set(KEY, '{"trails":1}');
    expect(loadTrails().corrupt).toBe(true);
  });

  it('flags a read that throws', () => {
    readError = new DOMException('SecurityError');
    expect(loadTrails().corrupt).toBe(true);
  });

  it('counts unusable entries and keeps the rest', () => {
    store.set(KEY, JSON.stringify([valid, { ...valid, id: 'b', distance: 'x' }, 'nope']));
    const result = loadTrails();
    expect(result.trails.map((t) => t.id)).toEqual(['a']);
    expect(result).toMatchObject({ failed: 2, total: 3, corrupt: false });
  });
});

describe('saveTrails', () => {
  it('writes a list that loadTrails reads back', () => {
    expect(saveTrails([valid])).toEqual({ ok: true });
    expect(loadTrails().trails).toHaveLength(1);
  });

  it('reports a write failure instead of throwing', () => {
    writeError = new DOMException('QuotaExceededError');
    expect(saveTrails([valid])).toEqual({ ok: false, reason: 'write' });
  });
});
