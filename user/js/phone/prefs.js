// Preferensi ponsel (Do Not Disturb). Dipakai shell dan app Settings.
const KEY = 'au.dnd';
let dnd = false;
try { dnd = localStorage.getItem(KEY) === '1'; } catch { /* storage mati */ }
const subs = new Set();

const APPEARANCE_KEY = 'au.appearance';
let appearance = 'light';
try {
  appearance = localStorage.getItem(APPEARANCE_KEY) === 'dark' ? 'dark' : 'light';
} catch { /* storage mati */ }

function applyAppearance() {
  document.documentElement.dataset.theme = appearance;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    appearance === 'dark' ? '#000000' : '#f2f2f7'
  );
}
applyAppearance();

export const getAppearance = () => appearance;
export function setAppearance(value) {
  if (value !== 'light' && value !== 'dark') return;
  appearance = value;
  try { localStorage.setItem(APPEARANCE_KEY, appearance); } catch { /* storage mati */ }
  applyAppearance();
  subs.forEach((fn) => fn());
}

export const isDnd = () => dnd;
export function setDnd(v) {
  dnd = !!v;
  try { localStorage.setItem(KEY, dnd ? '1' : '0'); } catch { /* abaikan */ }
  subs.forEach((fn) => fn());
}
export const onPrefs = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/* Kecepatan jam cerita: menit cerita per 1 menit nyata (1 = real time). Disimpan. */
const SPEED_KEY = 'au.speed';
let speed = 10;
try { speed = Number(localStorage.getItem(SPEED_KEY)) || 10; } catch { /* abaikan */ }
let paused = false; // hanya selama sesi

export const getSpeed = () => speed;
export function setSpeed(v) {
  speed = Number(v) || 10;
  try { localStorage.setItem(SPEED_KEY, String(speed)); } catch { /* abaikan */ }
  subs.forEach((fn) => fn());
}
export const isPaused = () => paused;
export function setPaused(v) { paused = !!v; subs.forEach((fn) => fn()); }
