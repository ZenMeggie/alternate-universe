// One global state shared by every app.
//   activeCharacterId – whose POV the reader is in
//   activeStoryDate   – 'YYYY-MM-DD' dari koleksi Firestore "timeline"
//   activeApp         – null | 'notes' | 'whatsapp' | 'gallery' | 'twitter' | 'stories'
// Extra: view ('landing' | 'home'), scope ('day' | 'upto'), focus (one-shot "open this item").
// Hanya activeCharacterId, activeStoryDate, scope yang disimpan ke localStorage.

import { getPlayable, getTimeline } from './data/store.js';

const STORAGE_KEY = 'au-story:v1';
const PERSISTED = ['activeCharacterId', 'activeStoryDate', 'scope'];

const state = {
  activeCharacterId: '',
  activeStoryDate: '',
  activeApp: null,
  view: 'landing',
  scope: 'day',
  focus: null,
};

const listeners = new Set();

/** Daftar tanggal cerita (urut) dari Firestore. */
export const getStoryDates = () => getTimeline().map((d) => d.date);

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSaved() {
  try {
    const out = {};
    for (const key of PERSISTED) out[key] = state[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* storage disabled: tetap jalan, hanya tidak mengingat pilihan */
  }
}

/** Panggil SETELAH `await startStore()`. */
export function initState() {
  const saved = readSaved();
  const ids = getPlayable().map((c) => c.id);
  const dates = getStoryDates();
  state.activeCharacterId = ids.includes(saved.activeCharacterId) ? saved.activeCharacterId : ids[0] || '';
  state.activeStoryDate = dates.includes(saved.activeStoryDate) ? saved.activeStoryDate : dates[0] || '';
  if (saved.scope === 'day' || saved.scope === 'upto') state.scope = saved.scope;
  return state;
}

export const getState = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch, { silent = false } = {}) {
  const changed = [];
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] !== value) {
      state[key] = value;
      changed.push(key);
    }
  }
  if (!changed.length) return false;
  if (changed.some((key) => PERSISTED.includes(key))) writeSaved();
  if (!silent) for (const listener of [...listeners]) listener(state, changed);
  return true;
}

export function setCharacter(id) {
  if (!getPlayable().some((c) => c.id === id)) return false;
  return setState({ activeCharacterId: id });
}

export function setDate(date) {
  if (!getStoryDates().includes(date)) return false;
  return setState({ activeStoryDate: date });
}

export function stepDate(delta) {
  const dates = getStoryDates();
  const index = dates.indexOf(state.activeStoryDate) + delta;
  if (index < 0 || index >= dates.length) return false;
  return setState({ activeStoryDate: dates[index] });
}

export const canStep = (delta) => {
  const dates = getStoryDates();
  const index = dates.indexOf(state.activeStoryDate) + delta;
  return index >= 0 && index < dates.length;
};

export const setScope = (scope) => (scope === 'day' || scope === 'upto') && setState({ scope });

/** Apps call this after acting on a focus request, so it fires only once. */
export const consumeFocus = () => setState({ focus: null }, { silent: true });