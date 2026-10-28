// Cangkang iPhone: status bar, dynamic island, back (swipe kiri), home indicator,
// Notification Center (kiri atas) dan Control Center (kanan atas) ala iOS.
// Ganti karakter/tanggal ada di app Settings, bukan di sini.
import { getState, subscribe } from '../state.js';
import { registerAction, navigate } from '../navigation.js';
import { $, esc, formatDayLong } from '../utils.js';
import { buildNotifications, notifCenterHtml, playBanners, clearBanners, minOf } from './notifications.js';
import { initClock, onTick, getNowMin, fmt } from './clock.js';
import { isDnd, setDnd, onPrefs } from './prefs.js';
import { getControls, setControl, toggleControl, onControls } from '../apps/controls.js';
import { getMusicState, onMusicChange, skipMusic, toggleMusic } from '../music-player.js';

let openSheet = null;
const backStack = [];
const cleared = new Set(); // notifikasi yang sudah dihapus pembaca (hanya sesi ini)

/* ---------- API untuk aplikasi ---------- */
/** Daftarkan handler back (mis. dari layar dalam ke daftar). Return fungsi untuk melepas. */
export function pushBack(fn) {
  backStack.push(fn);
  return () => { const i = backStack.indexOf(fn); if (i >= 0) backStack.splice(i, 1); };
}
export function goBack() {
  if (closeSheets()) return;
  const fn = backStack[backStack.length - 1];
  if (fn && fn() !== false) return;
  const s = getState();
  if (s.view === 'home' && s.activeApp) navigate('home');
}
export function goHome() {
  document.dispatchEvent(new CustomEvent('phone:home'));
  closeSheets();
  backStack.length = 0;
  navigate('home');
}

/* ---------- ikon ---------- */
const ic = (body, size = 22, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const SIGNAL = '<svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true"><path d="M1 10.5A1.5 1.5 0 0 1 2.5 9h1A1.5 1.5 0 0 1 5 10.5V13H1zM6 7.5A1.5 1.5 0 0 1 7.5 6h1A1.5 1.5 0 0 1 10 7.5V13H6zM11 4.5A1.5 1.5 0 0 1 12.5 3h1A1.5 1.5 0 0 1 15 4.5V13h-4zM16 1.5A1.5 1.5 0 0 1 17.5 0H18v13h-2z"/></svg>';
const WIFI = '<svg width="17" height="13" viewBox="0 0 17 13" aria-hidden="true"><path d="M1 4.5a11.2 11.2 0 0 1 15 0l-1.6 1.8a8.8 8.8 0 0 0-11.8 0zM4.4 8.1a6.1 6.1 0 0 1 8.2 0L11 10a3.7 3.7 0 0 0-5 0z"/><circle cx="8.5" cy="12" r="1"/></svg>';
const BATTERY = '<svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".72"/><rect x="2.2" y="2.1" width="19.8" height="8.8" rx="2" fill="currentColor"/><path d="M25 4v5c1-.3 1.7-1.2 1.7-2.5S26 4.3 25 4Z" fill="currentColor" opacity=".75"/></svg>';
const MUSIC_STATUS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 18V5l12-2v13M9 8l12-2M5 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm12-2a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/></svg>';
const PLANE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5z"/></svg>';
const MOON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>';

const CC_ICON = {
  airplane: ic('<path d="M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5z" fill="currentColor" stroke="none"/>', 22),
  cellular: ic('<path d="M4 20V14M9 20V10M14 20V6M19 20V3" stroke-width="2.6"/>', 22),
  wifi: ic('<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>', 22, 2),
  bluetooth: ic('<path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9"/>', 22, 2),
  orientation: ic('<path d="M15.5 9V7a3.5 3.5 0 0 0-7 0v2"/><rect x="6.5" y="9" width="11" height="10" rx="2"/><path d="M4.5 7.5A8 8 0 0 1 18 4l1.5 1.5M19.5 2.5v3h-3"/>', 23, 2),
  mirror: ic('<rect x="3" y="4" width="13" height="10" rx="2"/><rect x="8" y="10" width="13" height="10" rx="2"/>', 23, 2),
  moon: ic('<path d="M20.2 15.1A8.8 8.8 0 0 1 8.9 3.8 9.2 9.2 0 1 0 20.2 15.1Z" fill="currentColor" stroke="none"/>', 24),
  flashlight: ic('<path d="M8 3h8l-1 5H9z" fill="currentColor"/><path d="M9 8h6v12.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z" fill="currentColor"/><path d="M12 12v4" stroke="#222" stroke-width="1.8"/>', 24, 2),
  timer: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2.5h5M12 2.5v2"/>', 24, 2),
  calc: ic('<rect x="5" y="2.5" width="14" height="19" rx="3"/><rect x="8" y="5.5" width="8" height="3.5" rx="1" fill="currentColor"/><path d="M9 12h.1M12 12h.1M15 12h.1M9 15.5h.1M12 15.5h.1M15 15.5h.1M9 19h.1M12 19h.1M15 19h.1" stroke-width="2.8"/>', 23, 2),
  camera: ic('<path d="M4 7.5h3l1.6-2h6.8l1.6 2h3A2 2 0 0 1 22 9.5v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="4" fill="none" stroke="#222" stroke-width="1.8"/><circle cx="18.5" cy="10" r="1" fill="#222" stroke="none"/>', 24),
  sun: ic('<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.200 5.200L7 7M17 17l1.800 1.800M18.800 5.200L17 7M7 17l-1.800 1.800"/>', 24),
  volume: ic('<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" fill="currentColor"/><path d="M15.500 9a4.500 4.500 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>', 24),
  airplay: ic('<path d="M5 19H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1"/><path d="m8 16 4 5 4-5"/>', 20),
  previous: ic('<path d="M6 5v14M19 6v12l-9-6z" fill="currentColor" stroke="none"/>', 20),
  next: ic('<path d="M18 5v14M5 6v12l9-6z" fill="currentColor" stroke="none"/>', 20),
  gear: ic('<path d="M10 2.8h4l.7 2.4a7 7 0 0 1 1.5.9l2.4-.7 2 3.5-1.8 1.7a7 7 0 0 1 0 1.8l1.8 1.7-2 3.5-2.4-.7a7 7 0 0 1-1.5.9l-.7 2.4h-4l-.7-2.4a7 7 0 0 1-1.5-.9l-2.4.7-2-3.5 1.8-1.7a7 7 0 0 1 0-1.8L3.4 8.9l2-3.5 2.4.7a7 7 0 0 1 1.5-.9z"/><circle cx="12" cy="11.5" r="2.7"/>', 22, 1.9),
  play: ic('<path d="M7 5l12 7-12 7z" fill="currentColor"/>', 20, 1),
};

/* ---------- markup ---------- */
const GRAB = '<button type="button" class="sheet__grab" data-action="phone-close-sheets" aria-label="Close"><span></span></button>';

function shellHtml() {
  return `
  <div class="phone__island" aria-hidden="true"><i class="phone__lens"></i></div>
   <div class="phone__glare" aria-hidden="true"></div>
    <header class="statusbar">
      <button type="button" class="statusbar__zone statusbar__zone--l" data-zone="notif" aria-label="Notification Center"><time id="sb-time">9:41</time><span class="sb-ind" id="sb-ind"></span></button>
      <button type="button" class="statusbar__zone statusbar__zone--r" data-zone="control" aria-label="Control Center"><span class="sb-icons" id="sb-icons"></span></button>
    </header>
    <button type="button" class="sb-callpill" id="sb-callpill" data-action="call-resume" hidden aria-label="Return to call"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg><time id="sb-calltime">00:00</time></button>
    <div id="notif-banner" class="banner-host" aria-live="polite"></div>
    <div class="phone__edge" data-zone="edge" aria-hidden="true"></div>
    <div class="sheet-scrim" data-action="phone-close-sheets" hidden></div>
    <section id="sheet-notif" class="sheet sheet--notif" hidden aria-label="Notification Center"></section>
    <section id="sheet-control" class="sheet sheet--control" hidden aria-label="Control Center"></section>
    <div id="phone-torch" class="phone__torch" aria-hidden="true"></div>
    <div id="phone-dim" class="phone__dim" aria-hidden="true"></div>
    <button type="button" class="phone__home" data-zone="home" aria-label="Home"><span></span></button>`;
}

/* ---------- status bar ---------- */
function renderStatus() {
  const c = getControls();
  const parts = [];
  if (c.airplane) parts.push(PLANE);
  else {
    if (c.cellular) parts.push(SIGNAL);
    if (c.wifi) parts.push(WIFI);
  }
  if (getMusicState().playing) parts.push(MUSIC_STATUS);
  parts.push(BATTERY);
  const icons = $('#sb-icons');
  if (icons) icons.innerHTML = parts.join('');
  const ind = $('#sb-ind');
  if (ind) ind.innerHTML = isDnd() ? MOON : '';
}

function applyControls() {
  const c = getControls();
  const dim = $('#phone-dim');
  if (dim) dim.style.opacity = String((1 - c.brightness) * 0.65);
  $('#phone-torch')?.classList.toggle('is-on', !!c.flashlight);
}

const refreshClock = () => {
  const t = fmt(getNowMin());
  const a = $('#sb-time');
  if (a) a.textContent = t;
  const b = $('#nc-time');
  if (b) b.textContent = t;
};

/* ---------- Notification Center ---------- */
const nkey = (n) => `${n.ts}|${n.title}|${n.body}`;
const visibleNotifs = () => buildNotifications(getState(), Math.floor(getNowMin())).filter((n) => !cleared.has(nkey(n)));

function renderNotifSheet() {
  const s = getState();
  const list = visibleNotifs();
  $('#sheet-notif').innerHTML = `<div class="sheet__body">
      <div class="nc-clock"><p>${esc(formatDayLong(s.activeStoryDate))}</p><time id="nc-time">${esc(fmt(getNowMin()))}</time></div>
      <div class="sheet__head"><h2>Notifications</h2>${list.length ? '<button type="button" class="nc-clear" data-action="phone-clear-notifs" aria-label="Clear all notifications">✕</button>' : ''}</div>
      <div class="sheet__list">${notifCenterHtml(list)}</div>
    </div>${GRAB}`;
}

/* ---------- Control Center ---------- */
const round = (key, on, label) =>
  `<button type="button" class="cc-round cc-round--${key} ${on ? 'is-on' : ''}" data-action="cc-toggle" data-key="${key}" aria-pressed="${on}" aria-label="${label}">${CC_ICON[key]}</button>`;
const square = (key, on, label, extra = '') =>
  `<button type="button" class="cc-sq cc-sq--${key} ${on ? 'is-on' : ''} ${extra}" ${extra.includes('static') ? '' : `data-action="cc-toggle" data-key="${key}" aria-pressed="${on}"`} aria-label="${label}">${CC_ICON[key]}</button>`;

function renderControlSheet() {
  const c = getControls();
  const dnd = isDnd();
  const music = getMusicState();
  $('#sheet-control').innerHTML = `<div class="sheet__body">
      <div class="cc">
        <div class="cc-block cc-conn" role="group" aria-label="Connectivity">${round('airplane', c.airplane, 'Airplane mode')}${round('cellular', c.cellular, 'Cellular data')}${round('wifi', c.wifi, 'Wi-Fi')}${round('bluetooth', c.bluetooth, 'Bluetooth')}</div>
        <section class="cc-block cc-media" aria-label="Media controls">
          <div class="cc-media__top"><span class="cc-media__art" aria-hidden="true">${CC_ICON.play}</span><span class="cc-media__airplay">${CC_ICON.airplay}</span></div>
          <small class="cc-media__title">${esc(music.error || music.title || 'Not Playing')}</small>
          <div class="cc-media__controls" aria-label="Playback controls">
            <button type="button" data-music-action="previous" aria-label="Previous track" ${music.hasPrevious ? '' : 'disabled'}>${CC_ICON.previous}</button>
            <button type="button" class="cc-media__play" data-music-action="toggle" aria-label="${music.playing ? 'Pause' : 'Play'}" ${music.url ? '' : 'disabled'}>${music.playing ? ic('<path d="M7 5h4v14H7zM14 5h4v14h-4z" fill="currentColor" stroke="none"/>', 20) : CC_ICON.play}</button>
            <button type="button" data-music-action="next" aria-label="Next track" ${music.hasNext ? '' : 'disabled'}>${CC_ICON.next}</button>
          </div>
        </section>
        ${square('orientation', c.orientation, 'Orientation lock')}
        ${square('mirror', false, 'Screen mirroring', 'static')}
        <div class="cc-slider" data-slider="brightness" style="--v:${c.brightness}" role="slider" aria-label="Brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.brightness * 100)}"><span class="cc-slider__fill"></span><span class="cc-slider__ico">${CC_ICON.sun}</span></div>
        <div class="cc-slider" data-slider="volume" style="--v:${c.volume}" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.volume * 100)}"><span class="cc-slider__fill"></span><span class="cc-slider__ico">${CC_ICON.volume}</span></div>
        <button type="button" class="cc-focus ${dnd ? 'is-on' : ''}" data-action="phone-dnd" aria-pressed="${dnd}">${CC_ICON.moon}<span><b>${dnd ? 'Do Not Disturb' : 'Focus'}</b>${dnd ? '<small>On</small>' : ''}</span></button>
        <div class="cc-shortcuts" role="group" aria-label="Quick controls">
          ${square('flashlight', c.flashlight, 'Flashlight')}
          ${square('timer', false, 'Timer', 'static')}
          ${square('calc', false, 'Calculator', 'static')}
          ${square('camera', false, 'Camera', 'static')}
        </div>
        <button type="button" class="cc-settings" data-action="open-app" data-app="settings">${CC_ICON.gear}<span>Settings</span><span class="cc-settings__chevron">›</span></button>
      </div>
    </div>${GRAB}`;
}

/* ---------- sheets ---------- */
function showSheet(name) {
  closeSheets(true);
  if (name === 'notif') renderNotifSheet(); else renderControlSheet();
  $(`#sheet-${name}`).hidden = false;
  $('.sheet-scrim').hidden = false;
  if (name === 'control') $('#phone-screen').classList.add('has-control-center');
  requestAnimationFrame(() => requestAnimationFrame(() => $(`#sheet-${name}`).classList.add('is-open')));
  openSheet = name;
}
function closeSheets(silent) {
  if (!openSheet) return false;
  const el = $(`#sheet-${openSheet}`);
  el.classList.remove('is-open');
  const done = () => { if (!el.classList.contains('is-open')) el.hidden = true; };
  silent ? done() : setTimeout(done, 340);
  $('.sheet-scrim').hidden = true;
  $('#phone-screen').classList.remove('has-control-center');
  openSheet = null;
  return !silent;
}
const toggleSheet = (name) => (openSheet === name ? closeSheets() : showSheet(name));

/* ---------- banner ---------- */
function refreshBanners() {
  const host = $('#notif-banner');
  if (host && (isDnd() || getState().view !== 'home')) clearBanners(host);
}

/** Dipanggil tiap tick jam cerita: munculkan notifikasi yang waktunya baru saja terlewati. */
function onClockTick(prev, now, reset) {
  refreshClock();
  const host = $('#notif-banner');
  if (reset) { clearBanners(host); return; }
  const a = Math.floor(prev), b = Math.floor(now);
  if (b === a) return;
  const fresh = buildNotifications(getState(), b)
    .filter((n) => { const m = minOf(n.ts); return m > a && m <= b; })
    .reverse(); // paling lama dulu
  if (!fresh.length) return;
  if (openSheet === 'notif') renderNotifSheet();
  if (!isDnd()) playBanners(host, fresh);
}

/* ---------- gestur ---------- */
function gesture(el, onEnd) {
  let sx = 0, sy = 0, id = null;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; id = e.pointerId; el.setPointerCapture?.(id); });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = null;
    onEnd(e.clientX - sx, e.clientY - sy);
  });
  el.addEventListener('pointercancel', () => { id = null; });
}
const isTap = (dx, dy) => Math.abs(dx) < 8 && Math.abs(dy) < 8;

function bindGestures() {
  const phone = $('#phone-screen');
  gesture(phone.querySelector('[data-zone="notif"]'), (dx, dy) => { if (isTap(dx, dy) || dy > 30) toggleSheet('notif'); });
  gesture(phone.querySelector('[data-zone="control"]'), (dx, dy) => { if (isTap(dx, dy) || dy > 30) toggleSheet('control'); });
  gesture(phone.querySelector('[data-zone="edge"]'), (dx) => { if (dx > 70) goBack(); });
  gesture(phone.querySelector('[data-zone="home"]'), (dx, dy) => { if (isTap(dx, dy) || dy < -30) goHome(); });
}

/** Swipe ke atas di handle bawah menutup sheet; tap notifikasi menutup sheet; slider bisa digeser. */
function bindSheets() {
  for (const id of ['sheet-notif', 'sheet-control']) {
    const el = $(`#${id}`);
    let startY = null;
    el.addEventListener('pointerdown', (e) => { startY = e.target.closest('.sheet__grab') ? e.clientY : null; });
    el.addEventListener('pointerup', (e) => {
      if (startY != null && e.clientY - startY < -30) closeSheets();
      startY = null;
    });
  }
  $('#sheet-notif').addEventListener('click', (e) => { if (e.target.closest('.notif')) closeSheets(); });

  const cc = $('#sheet-control');
  cc.addEventListener('click', (event) => {
    const button = event.target.closest('[data-music-action]');
    if (!button) return;
    const action = button.dataset.musicAction;
    if (action === 'toggle') toggleMusic().catch((error) => console.warn('Unable to play story music', error));
    if (action === 'previous') skipMusic(-1).catch((error) => console.warn('Unable to play previous story music', error));
    if (action === 'next') skipMusic(1).catch((error) => console.warn('Unable to play next story music', error));
  });
  let active = null;
  const apply = (el, e) => {
    const r = el.getBoundingClientRect();
    const raw = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    const key = el.dataset.slider;
    const value = key === 'brightness' ? Math.max(0.15, raw) : raw;
    setControl(key, value);
    el.style.setProperty('--v', String(value));
    el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  cc.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.cc-slider');
    if (!el) return;
    active = el;
    el.setPointerCapture?.(e.pointerId);
    apply(el, e);
  });
  cc.addEventListener('pointermove', (e) => { if (active) apply(active, e); });
  const end = () => { active = null; };
  cc.addEventListener('pointerup', end);
  cc.addEventListener('pointercancel', end);
}

/* ---------- init ---------- */
export function initPhone() {
  const screen = $('#phone-screen');
  if (!screen) return;
  screen.insertAdjacentHTML('beforeend', shellHtml());

  registerAction('phone-close-sheets', () => closeSheets());
  registerAction('phone-dnd', () => setDnd(!isDnd()));
  registerAction('cc-toggle', (el) => toggleControl(el.dataset.key));
  registerAction('phone-clear-notifs', () => {
    visibleNotifs().forEach((n) => cleared.add(nkey(n)));
    renderNotifSheet();
  });

  bindGestures();
  bindSheets();
  renderStatus();
  applyControls();
  refreshClock();

  onControls((key) => {
    renderStatus();
    applyControls();
    if (openSheet === 'control' && key !== 'brightness' && key !== 'volume') renderControlSheet();
  });
  let controlMusicKey = '';
  onMusicChange((music) => {
    renderStatus();
    if (openSheet !== 'control') return;
    const key = `${music.url}|${music.playing}|${music.error}|${music.hasPrevious}|${music.hasNext}`;
    if (key === controlMusicKey) return;
    controlMusicKey = key;
    renderControlSheet();
  });
  onPrefs(() => { renderStatus(); if (openSheet === 'control') renderControlSheet(); refreshBanners(); });

  // Indikator call di Dynamic Island: ikon telepon hijau + timer, tap untuk kembali ke call.
  const island = $('.phone__island');
  if (island) {
    island.insertAdjacentHTML('beforeend',
      '<span class="isl-call__ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg></span><time class="isl-call__time" id="sb-calltime">00:00</time>');
  }
  document.addEventListener('call:change', (e) => {
    const { live, minimized, sec } = e.detail;
    const show = live && minimized;
    if (island) {
      island.classList.toggle('is-call', show);
      if (show) island.setAttribute('data-action', 'call-resume');
      else island.removeAttribute('data-action');
    }
    const t = $('#sb-calltime');
    if (t) t.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  });

  onTick(onClockTick);
  initClock();

  subscribe((_s, changed) => {
    if (changed.includes('activeApp') || changed.includes('view')) closeSheets(true);
    if (changed.includes('view')) refreshBanners();
    if (openSheet === 'notif' && (changed.includes('activeCharacterId') || changed.includes('activeStoryDate'))) renderNotifSheet();
  });
}