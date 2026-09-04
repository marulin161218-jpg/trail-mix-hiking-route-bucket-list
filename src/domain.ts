// Pure domain logic. No DOM, no storage, no clock: `now` always arrives as a parameter.

export type Unit = 'km' | 'mi';
export type Difficulty = 'easy' | 'moderate' | 'hard' | 'epic';
export type Status = 'want' | 'done';

export const DIFFICULTIES = ['easy', 'moderate', 'hard', 'epic'] as const;

export type Trail = {
  id: string; name: string; location: string; distance: number; unit: Unit;
  difficulty: Difficulty; notes: string; status: Status; createdAt: number;
};

/** Raw form values, all strings, straight out of the inputs. */
export type Draft = {
  name: string; location: string; distance: string;
  unit: string; difficulty: string; notes: string;
};

export type ErrorField = 'name' | 'location' | 'distance' | 'difficulty';
export type Errors = Partial<Record<ErrorField, string>>;
export type Summary = { total: number; completed: number; completedKm: number };

const MI_TO_KM = 1.609344;

/** Trims and collapses whitespace runs in a single line text field. */
export const clean = (v: unknown): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';

/** Accepts "12", "12.4", "12,4". Rejects "", "abc", "12km", "-4", "1e3", NaN, Infinity. */
export const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim().replace(',', '.');
  return /^\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};

export const toKm = (distance: number, unit: Unit): number =>
  unit === 'mi' ? distance * MI_TO_KM : distance;

/** Field level validation for the add and edit form. An empty object means valid. */
export function validateDraft(d: Draft): Errors {
  const e: Errors = {};
  if (!clean(d.name)) e.name = 'Nama trail wajib diisi.';
  if (!clean(d.location)) e.location = 'Lokasi wajib diisi.';
  const dist = toNumber(d.distance);
  if (Number.isNaN(dist)) e.distance = 'Jarak harus berupa angka, misalnya 12.4';
  else if (dist <= 0) e.distance = 'Jarak harus lebih besar dari 0.';
  if (!(DIFFICULTIES as readonly string[]).includes(d.difficulty))
    e.difficulty = 'Pilih salah satu tingkat kesulitan.';
  return e;
}

/**
 * The single gate every trail passes through, both form submissions and stored
 * entries. Returns null for unusable input: missing name or location, distance
 * that is not a positive number, unknown difficulty.
 */
export function normalizeTrail(raw: unknown, now: number, fallbackId: string): Trail | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = clean(r.name);
  const location = clean(r.location);
  const distance = toNumber(r.distance);
  if (!name || !location || Number.isNaN(distance) || distance <= 0) return null;
  if (!(DIFFICULTIES as readonly string[]).includes(r.difficulty as string)) return null;
  return {
    id: clean(r.id) || fallbackId, name, location,
    distance: Math.round(distance * 100) / 100,
    unit: r.unit === 'mi' ? 'mi' : 'km', difficulty: r.difficulty as Difficulty,
    notes: typeof r.notes === 'string' ? r.notes.trim() : '',
    status: r.status === 'done' ? 'done' : 'want',
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now,
  };
}

/** Splits into the two status groups, newest first inside each group. */
export function sortByStatus(trails: readonly Trail[]): { want: Trail[]; done: Trail[] } {
  const newest = (a: Trail, b: Trail) => b.createdAt - a.createdAt || a.name.localeCompare(b.name);
  return {
    want: trails.filter((t) => t.status === 'want').sort(newest),
    done: trails.filter((t) => t.status === 'done').sort(newest),
  };
}

/** Summary bar totals. Distance counts completed trails only, converted to km. */
export function summarize(trails: readonly Trail[]): Summary {
  let completed = 0;
  let km = 0;
  for (const t of trails) {
    if (t.status !== 'done') continue;
    completed += 1;
    km += toKm(t.distance, t.unit);
  }
  return { total: trails.length, completed, completedKm: Math.round(km * 100) / 100 };
}
