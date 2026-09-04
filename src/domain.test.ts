import { describe, expect, it } from 'vitest';
import { normalizeTrail, sortByStatus, summarize, validateDraft, type Draft, type Trail } from './domain';

const NOW = 1_700_000_000_000;
const draft: Draft = {
  name: 'Rinjani via Sembalun', location: 'Lombok Timur, NTB', distance: '12.4',
  unit: 'km', difficulty: 'hard', notes: '  Target ulang tahun ke-30  ',
};
const trail = (over: Partial<Trail>): Trail => ({
  id: 'x', name: 'Trail', location: 'Loc', distance: 10, unit: 'km',
  difficulty: 'easy', notes: '', status: 'want', createdAt: NOW, ...over,
});

describe('normalizeTrail', () => {
  it('cleans a draft and fills id, status, timestamp', () => {
    expect(normalizeTrail({ ...draft, name: ' Rinjani   via  Sembalun ' }, NOW, 'gen-1')).toEqual({
      id: 'gen-1', name: 'Rinjani via Sembalun', location: 'Lombok Timur, NTB',
      distance: 12.4, unit: 'km', difficulty: 'hard',
      notes: 'Target ulang tahun ke-30', status: 'want', createdAt: NOW,
    });
  });

  it('keeps an existing id, status, timestamp', () => {
    expect(normalizeTrail({ ...draft, id: 'abc', status: 'done', createdAt: 42 }, NOW, 'g'))
      .toMatchObject({ id: 'abc', status: 'done', createdAt: 42 });
  });

  it('takes a comma decimal, rounds to two places', () => {
    expect(normalizeTrail({ ...draft, distance: '12,456' }, NOW, 'g')?.distance).toBe(12.46);
  });

  it('falls back to km and want on unknown unit or status', () => {
    expect(normalizeTrail({ ...draft, unit: 'parsec', status: 'maybe' }, NOW, 'g'))
      .toMatchObject({ unit: 'km', status: 'want' });
  });

  const invalid: Record<string, Partial<Draft>> = {
    'nama kosong': { name: '   ' },
    'lokasi kosong': { location: '' },
    'jarak bukan angka': { distance: '12km' },
    'jarak nol': { distance: '0' },
    'jarak negatif': { distance: '-4' },
    'difficulty tak dikenal': { difficulty: 'extreme' },
  };
  for (const [label, patch] of Object.entries(invalid)) {
    it(`rejects ${label}`, () => expect(normalizeTrail({ ...draft, ...patch }, NOW, 'g')).toBeNull());
  }
});

describe('validateDraft', () => {
  it('passes a valid draft', () => expect(validateDraft(draft)).toEqual({}));

  it('reports every broken field at once', () => {
    const errs = validateDraft({ ...draft, name: ' ', location: '', distance: 'abc', difficulty: '' });
    expect(Object.keys(errs).sort()).toEqual(['difficulty', 'distance', 'location', 'name']);
  });

  it('separates non numeric from non positive distance', () => {
    expect(validateDraft({ ...draft, distance: 'abc' }).distance).toMatch(/angka/);
    expect(validateDraft({ ...draft, distance: '0' }).distance).toMatch(/lebih besar/);
  });
});

describe('sortByStatus', () => {
  it('splits groups newest first, input untouched', () => {
    const input = [trail({ id: 'a', createdAt: 1 }), trail({ id: 'b', createdAt: 3, status: 'done' }), trail({ id: 'c', createdAt: 2 })];
    const { want, done } = sortByStatus(input);
    expect(want.map((t) => t.id)).toEqual(['c', 'a']);
    expect(done.map((t) => t.id)).toEqual(['b']);
    expect(input.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('summarize', () => {
  it('returns zeros for an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, completed: 0, completedKm: 0 });
  });

  it('sums completed distance only, mi converted to km', () => {
    const list = [trail({ status: 'done', distance: 10 }), trail({ status: 'done', distance: 5, unit: 'mi' }), trail({ distance: 99 })];
    expect(summarize(list)).toEqual({ total: 3, completed: 2, completedKm: 18.05 });
  });
});
