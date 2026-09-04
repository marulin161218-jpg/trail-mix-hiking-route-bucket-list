import mountains from '@phosphor-icons/core/assets/bold/mountains-bold.svg?raw';
import footprints from '@phosphor-icons/core/assets/bold/footprints-bold.svg?raw';
import checkCircle from '@phosphor-icons/core/assets/bold/check-circle-bold.svg?raw';
import mapPin from '@phosphor-icons/core/assets/bold/map-pin-bold.svg?raw';

import {
  normalizeTrail, sortByStatus, summarize, validateDraft,
  type Draft, type ErrorField, type Errors, type Status, type Trail,
} from './domain';
import { loadTrails, saveTrails } from './storage';

const ICONS = { mountains, footprints, 'check-circle': checkCircle, 'map-pin': mapPin };
type IconName = keyof typeof ICONS;

const parser = new DOMParser();
const iconCache = new Map<IconName, Element>();

/** Phosphor SVG, parsed once, cloned per use. */
function icon(name: IconName): Node {
  let node = iconCache.get(name);
  if (!node) {
    node = parser.parseFromString(ICONS[name], 'image/svg+xml').documentElement;
    node.setAttribute('class', 'ico');
    node.setAttribute('aria-hidden', 'true');
    iconCache.set(name, node);
  }
  return node.cloneNode(true);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

const pick = <T extends Element = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const main = pick('#main-content');
const loadAlert = pick('#load-alert');
const form = pick<HTMLFormElement>('#trail-form');
const formHeading = pick('#form-heading');
const formAlert = pick('#form-alert');
const submitLabel = pick('#submit-label');
const cancelBtn = pick<HTMLButtonElement>('#cancel-btn');
const firstBtn = pick<HTMLButtonElement>('#first-btn');
const lists = pick('.lists');
const live = pick('#live-region');
const fName = pick<HTMLInputElement>('#f-name');
const fLoc = pick<HTMLInputElement>('#f-loc');
const fDist = pick<HTMLInputElement>('#f-dist');
const fUnit = pick<HTMLSelectElement>('#f-unit');
const fDiff = pick<HTMLSelectElement>('#f-diff');
const fNotes = pick<HTMLTextAreaElement>('#f-notes');
const FIELDS: Record<ErrorField, readonly [HTMLElement, HTMLElement]> = {
  name: [fName, pick('#e-name')],
  location: [fLoc, pick('#e-loc')],
  distance: [fDist, pick('#e-dist')],
  difficulty: [fDiff, pick('#e-diff')],
};

let trails: Trail[] = [];
let editingId: string | null = null;
let armed: HTMLButtonElement | null = null;

function actBtn(act: string, t: Trail, label: string, cls: string) {
  const btn = el('button', `btn btn--sm ${cls}`);
  btn.type = 'button';
  btn.dataset.act = act;
  btn.dataset.id = t.id;
  btn.setAttribute('aria-label', `${label}: ${t.name}`);
  btn.append(el('span', undefined, label));
  return btn;
}

function cardOf(t: Trail, i: number) {
  const li = el('li', t.status === 'done' ? 'card card--done' : 'card');
  li.dataset.id = t.id;
  li.style.setProperty('--i', String(i));

  const flags = el('div', 'card__flags');
  flags.append(el('span', `badge badge--${t.difficulty}`, t.difficulty));
  if (t.status === 'done') flags.append(el('span', 'tag', 'Selesai'));
  const top = el('div', 'card__top');
  top.append(el('h3', 'card__name', t.name), flags);

  const meta = el('p', 'card__meta');
  meta.append(icon('map-pin'), document.createTextNode(t.location));
  const dist = el('p', 'card__dist', String(t.distance));
  dist.append(el('span', undefined, t.unit));
  li.append(top, meta, dist);

  // Long notes collapse into details/summary, so expanding works by keyboard.
  if (t.notes.length > 90) {
    const details = el('details', 'notes');
    details.append(el('summary', undefined, 'Catatan pribadi'), el('p', undefined, t.notes));
    li.append(details);
  } else if (t.notes) {
    li.append(el('p', 'notes', t.notes));
  }

  const acts = el('div', 'card__acts');
  acts.append(
    t.status === 'done'
      ? actBtn('toggle', t, 'Buka lagi', 'btn--ghost')
      : actBtn('toggle', t, 'Tandai selesai', 'btn--go'),
    actBtn('edit', t, 'Ubah', 'btn--ghost'),
    actBtn('del', t, 'Hapus', 'btn--ghost'),
  );
  li.append(acts, el('p', 'error'));
  return li;
}

function render(): void {
  const { want, done } = sortByStatus(trails);
  const sum = summarize(trails);
  pick('#stat-total').textContent = String(sum.total);
  pick('#stat-done').textContent = String(sum.completed);
  pick('#stat-km').textContent = sum.completedKm.toFixed(1).replace(/\.0$/, '');
  pick('#count-want').textContent = `${want.length} trail`;
  pick('#count-done').textContent = `${done.length} trail`;
  pick('#list-want').replaceChildren(...want.map(cardOf));
  pick('#list-done').replaceChildren(...done.map(cardOf));

  const blank = trails.length === 0;
  pick('#empty-all').hidden = !blank;
  pick('#sec-want').hidden = blank;
  pick('#sec-done').hidden = blank;
  pick('#empty-want').hidden = blank || want.length > 0;
  pick('#empty-done').hidden = blank || done.length > 0;
}

/** One write path for all four mutations. A failed save commits nothing. */
function commit(next: Trail[], slot: HTMLElement, message: string): boolean {
  const result = saveTrails(next);
  if (!result.ok) {
    slot.textContent = 'Gagal menyimpan. Coba lagi.';
    live.textContent = 'Perubahan gagal disimpan.';
    return false;
  }
  trails = next;
  slot.textContent = '';
  render();
  live.textContent = message;
  return true;
}

function showErrors(errs: Errors): void {
  let firstInvalid: HTMLElement | null = null;
  for (const key of Object.keys(FIELDS) as ErrorField[]) {
    const [input, slot] = FIELDS[key];
    const message = errs[key] ?? '';
    slot.textContent = message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      firstInvalid ??= input;
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
  firstInvalid?.focus();
}

function resetForm(): void {
  form.reset();
  editingId = null;
  formHeading.textContent = 'Tambah trail';
  submitLabel.textContent = 'Tambah trail';
  cancelBtn.hidden = true;
  showErrors({});
  formAlert.textContent = '';
}

function startEdit(id: string): void {
  const t = trails.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  fName.value = t.name;
  fLoc.value = t.location;
  fDist.value = String(t.distance);
  fUnit.value = t.unit;
  fDiff.value = t.difficulty;
  fNotes.value = t.notes;
  showErrors({});
  formAlert.textContent = '';
  formHeading.textContent = 'Ubah trail';
  submitLabel.textContent = 'Simpan perubahan';
  cancelBtn.hidden = false;
  live.textContent = `Mengubah ${t.name}. Form sudah terisi data lama.`;
  fName.focus();
  fName.scrollIntoView({ block: 'nearest' });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const draft: Draft = {
    name: fName.value, location: fLoc.value, distance: fDist.value,
    unit: fUnit.value, difficulty: fDiff.value, notes: fNotes.value,
  };
  const errs = validateDraft(draft);
  showErrors(errs);
  if (Object.keys(errs).length > 0) {
    live.textContent = 'Trail belum tersimpan. Periksa pesan di bawah field yang ditandai.';
    return;
  }
  const now = Date.now();
  const editing = editingId ? trails.find((t) => t.id === editingId) : undefined;
  const raw = { ...editing, ...draft, id: editing?.id, createdAt: editing?.createdAt, status: editing?.status };
  const trail = normalizeTrail(raw, now, crypto.randomUUID?.() ?? `t${now}-${trails.length}`);
  if (!trail) {
    formAlert.textContent = 'Data trail belum lengkap. Periksa kembali isian.';
    return;
  }
  const next = editing ? trails.map((t) => (t.id === editing.id ? trail : t)) : [trail, ...trails];
  const done = editing ? `${trail.name} diperbarui.` : `${trail.name} masuk daftar Want to Hike.`;
  if (commit(next, formAlert, done)) resetForm();
});

cancelBtn.addEventListener('click', () => {
  resetForm();
  live.textContent = 'Pengubahan dibatalkan.';
  fName.focus();
});

firstBtn.addEventListener('click', () => fName.focus());

function disarm(): void {
  if (!armed) return;
  delete armed.dataset.confirm;
  armed.querySelector('span:last-child')!.textContent = 'Hapus';
  armed = null;
}

const slotOf = (btn: HTMLButtonElement): HTMLElement =>
  btn.closest('.card')!.querySelector<HTMLElement>('.error')!;

function toggleStatus(id: string, btn: HTMLButtonElement): void {
  const t = trails.find((x) => x.id === id);
  if (!t) return;
  const status: Status = t.status === 'done' ? 'want' : 'done';
  disarm();
  const next = trails.map((x) => (x.id === id ? { ...x, status } : x));
  const done =
    status === 'done' ? `${t.name} ditandai selesai.` : `${t.name} kembali ke Want to Hike.`;
  if (!commit(next, slotOf(btn), done)) return;
  pick<HTMLButtonElement>(`.card[data-id="${CSS.escape(id)}"] button[data-act="toggle"]`).focus();
}

function removeTrail(id: string, btn: HTMLButtonElement): void {
  const group = btn.closest('ul')!;
  const name = trails.find((t) => t.id === id)?.name ?? 'Trail';
  const slot = slotOf(btn);
  disarm();
  if (!commit(trails.filter((t) => t.id !== id), slot, `${name} dihapus dari daftar.`)) return;
  if (editingId === id) resetForm();
  const nextBtn = group.querySelector<HTMLButtonElement>('button[data-act="del"]');
  if (nextBtn) nextBtn.focus();
  else if (trails.length === 0) firstBtn.focus();
  else group.closest('section')!.querySelector<HTMLElement>('h2')!.focus();
}

lists.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id!;
  if (btn.dataset.act === 'edit') {
    disarm();
    startEdit(id);
  } else if (btn.dataset.act === 'toggle') {
    toggleStatus(id, btn);
  } else if (armed !== btn) {
    disarm();
    armed = btn;
    btn.dataset.confirm = '1';
    btn.querySelector('span:last-child')!.textContent = 'Yakin? Klik lagi';
    live.textContent = 'Konfirmasi hapus. Aktifkan sekali lagi untuk hapus, Escape untuk batal.';
  } else {
    removeTrail(id, btn);
  }
});

lists.addEventListener('focusout', (event) => {
  if (armed !== event.target) return;
  disarm();
  live.textContent = 'Hapus dibatalkan.';
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !armed) return;
  const btn = armed;
  disarm();
  btn.focus();
  live.textContent = 'Hapus dibatalkan.';
});

/* Boot: the skeleton ships in the static HTML and is swapped after the first painted frame. */

async function boot(): Promise<void> {
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
    node.append(icon(node.dataset.icon as IconName));
  });
  const loaded = loadTrails();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  main.classList.remove('is-loading');
  trails = loaded.trails;
  if (loaded.corrupt) {
    loadAlert.textContent =
      'Data tersimpan rusak: 1 rekaman gagal dimuat. Daftar dimulai kosong, data lama belum ditimpa.';
  } else if (loaded.failed > 0) {
    loadAlert.textContent = `${loaded.failed} dari ${loaded.total} entri tersimpan gagal dimuat dan dilewati.`;
  }
  render();
}

void boot();
