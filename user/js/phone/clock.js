// Jam cerita. Mulai dari jam paling awal pada tanggal yang dipilih, baru berjalan
// setelah pemain masuk ke ponsel. Tiap tick melaporkan rentang waktu (prev -> now),
// supaya notifikasi bisa muncul tepat saat jam cerita melewati waktu kejadiannya.
import { getState, subscribe } from '../state.js';
import { chatsFor, notesFor, galleryFor, accountsOf, postsOfAccount } from '../data/store.js';
import { dateKey } from '../utils.js';
import { minOf } from './notifications.js';
import { getSpeed, isPaused } from './prefs.js';

const FALLBACK_START = 9 * 60 + 41;
const DAY_END = 23 * 60 + 59;

let nowMin = FALLBACK_START;
let timer = null;
let last = 0;
let day = '';
const subs = new Set();

export const getNowMin = () => nowMin;
export const fmt = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
/** fn(prevMin, nowMin, reset). reset=true saat jam di-set ulang (jangan munculkan notifikasi). */
export const onTick = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = (prev, now, reset) => subs.forEach((fn) => { try { fn(prev, now, reset); } catch (e) { console.error(e); } });

/** Menit paling awal milik karakter aktif pada hari terpilih. */
function earliestMinute(state) {
  const me = state.activeCharacterId, d = state.activeStoryDate;
  const dayState = { ...state, scope: 'day' };
  const stamps = [];
  for (const chat of chatsFor({ ...state, scope: 'upto' })) for (const m of chat.messages) if (dateKey(m.timestamp) === d) stamps.push(m.timestamp);
  for (const n of notesFor(dayState)) stamps.push(n.updatedAt);
  for (const p of galleryFor(dayState)) stamps.push(p.timestamp);
  for (const a of accountsOf(me)) for (const p of postsOfAccount(dayState, me, a.id)) stamps.push(p.timestamp);
  const mins = stamps.map(minOf).filter((m) => m != null);
  return mins.length ? Math.min(...mins) : FALLBACK_START;
}

function reset() {
  const s = getState();
  day = s.activeStoryDate;
  nowMin = earliestMinute(s);
  emit(nowMin, nowMin, true);
}

function step() {
  const t = Date.now();
  const dt = (t - last) / 1000;
  last = t;
  if (document.hidden || isPaused() || nowMin >= DAY_END) return;
  const prev = nowMin;
  nowMin = Math.min(DAY_END, nowMin + (dt * getSpeed()) / 60);
  emit(prev, nowMin, false);
}

function start() {
  if (timer) return;
  last = Date.now();
  timer = setInterval(step, 1000);
}
function stop() {
  clearInterval(timer);
  timer = null;
}

export function initClock() {
  const s = getState();
  reset();
  if (s.view === 'home') start();

  subscribe((state, changed) => {
    if (changed.includes('view')) {
      if (state.view === 'home') { reset(); start(); } // masuk ke ponsel: cerita dimulai
      else { stop(); reset(); }                        // kembali ke menu: berhenti
    } else if (changed.includes('activeStoryDate') && state.activeStoryDate !== day) {
      reset();                                         // ganti tanggal: mulai dari awal hari itu
    }
  });
}
