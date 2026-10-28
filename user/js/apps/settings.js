// App Settings ala iOS. Ganti karakter = ganti akun Apple ID. Ganti tanggal cerita ada di Date & Time.
import { getState, subscribe, setCharacter, setDate, setScope, getStoryDates } from '../state.js';
import { getPlayable, getCharacter, avatarHtml, onStoreChange, getTimeline } from '../data/store.js';
import { registerApp, registerAction, navigate } from '../navigation.js';
import { pushBack } from '../phone/shell.js';
import { isDnd, setDnd, onPrefs, getSpeed, setSpeed, isPaused, setPaused, getAppearance, setAppearance } from '../phone/prefs.js';
import { esc, $, formatFullDate, formatDayShort } from '../utils.js';

let root = null;
let screen = 'root';
let offBack = null;

const chev = '<span class="ios-chev">›</span>';
const sw = (on) => `<span class="ios-switch ${on ? 'is-on' : ''}"><i></i></span>`;
const email = (c) => `${c.username || c.id}@icloud.com`;

function go(name) {
  screen = name;
  if (!offBack) offBack = pushBack(() => { back(); return true; });
  render();
}
function back() {
  screen = 'root';
  offBack?.(); offBack = null;
  render();
}

const nav = (title) => `<header class="ios-nav"><button type="button" class="ios-back" data-action="settings-back">‹ Settings</button><h2>${esc(title)}</h2><span></span></header>`;

function rootScreen(s, me) {
  return `<div class="ios-page">
    <h1 class="ios-large">Settings</h1>
    <div class="ios-search"><span>⌕</span> Search</div>
    <button type="button" class="ios-card" data-action="settings-go" data-screen="apple-id">
      ${avatarHtml(me, 60)}
      <span class="ios-card__txt"><strong>${esc(me.name)}</strong><small>Apple Account, iCloud+, Media &amp; Purchases</small></span>${chev}
    </button>
    <ul class="ios-group">
      <li><button type="button" class="ios-row" data-action="settings-dnd"><span class="ios-ico ios-ico--focus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.7A8.5 8.5 0 0 1 9.3 4.5a8.5 8.5 0 1 0 10.2 10.2Z"/></svg></span><span class="ios-row__t">Do Not Disturb</span>${sw(isDnd())}</button></li>
      <li><button type="button" class="ios-row" data-action="settings-go" data-screen="appearance"><span class="ios-ico ios-ico--appearance"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z"/></svg></span><span class="ios-row__t">Display &amp; Brightness</span><span class="ios-val">${getAppearance() === 'dark' ? 'Dark' : 'Light'}</span>${chev}</button></li>
      <li><button type="button" class="ios-row" data-action="settings-go" data-screen="date"><span class="ios-ico ios-ico--calendar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/></svg></span><span class="ios-row__t">Date &amp; Time</span><span class="ios-val">${esc(formatDayShort(s.activeStoryDate))}</span>${chev}</button></li>
    </ul>
    <ul class="ios-group">
      <li><button type="button" class="ios-row ios-row--danger" data-action="settings-exit"><span class="ios-row__t">Back to Story Menu</span></button></li>
    </ul>
  </div>`;
}

function appleIdScreen(s, me) {
  const rows = getPlayable().map((c) => `<li><button type="button" class="ios-row" data-action="settings-pick-char" data-id="${esc(c.id)}">
      ${avatarHtml(c, 40)}<span class="ios-row__stack"><b>${esc(c.name)}</b><small>${esc(email(c))}</small></span>${c.id === s.activeCharacterId ? '<span class="ios-check">✓</span>' : ''}
    </button></li>`).join('');
  return `${nav('Apple ID')}<div class="ios-page ios-page--sub">
    <div class="ios-hero">${avatarHtml(me, 96)}<h3>${esc(me.name)}</h3><p>${esc(email(me))}</p></div>
    <ul class="ios-group">
      <li class="ios-row ios-row--static"><span class="ios-row__t">Name</span><span class="ios-val">${esc(me.fullName || me.name)}</span></li>
      <li class="ios-row ios-row--static"><span class="ios-row__t">Username</span><span class="ios-val">@${esc(me.username || me.id)}</span></li>
      ${me.phone ? `<li class="ios-row ios-row--static"><span class="ios-row__t">Phone</span><span class="ios-val">${esc(me.phone)}</span></li>` : ''}
      ${me.location ? `<li class="ios-row ios-row--static"><span class="ios-row__t">Location</span><span class="ios-val">${esc(me.location)}</span></li>` : ''}
    </ul>
    <p class="ios-label">Sign in as</p>
    <ul class="ios-group">${rows}</ul>
    <p class="ios-foot">Switching account changes whose phone you are reading. Every app follows.</p>
  </div>`;
}

function appearanceScreen() {
  const selected = getAppearance();
  const option = (mode, title, description) => `<li><button type="button" class="ios-row ios-appearance-option" data-action="settings-appearance" data-mode="${mode}">
      <span class="ios-appearance-preview ios-appearance-preview--${mode}" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="ios-row__stack"><b>${title}</b><small>${description}</small></span>${selected === mode ? '<span class="ios-check">✓</span>' : ''}
    </button></li>`;
  return `${nav('Display & Brightness')}<div class="ios-page ios-page--sub">
    <p class="ios-label">Appearance</p>
    <ul class="ios-group">${option('light', 'Light', 'A bright appearance across the app')}${option('dark', 'Dark', 'A darker appearance across the app')}</ul>
    <p class="ios-foot">Your appearance is saved on this device and applied to every screen and app.</p>
  </div>`;
}

const speedRow = (v, label) => `<li><button type="button" class="ios-row" data-action="settings-speed" data-speed="${v}"><span class="ios-row__t">${label}</span>${getSpeed() === v ? '<span class="ios-check">✓</span>' : ''}</button></li>`;

function dateScreen(s) {
  const titles = new Map(getTimeline().map((d) => [d.date, d.title]));
  const rows = getStoryDates().map((d) => `<li><button type="button" class="ios-row" data-action="settings-pick-date" data-date="${esc(d)}">
      <span class="ios-row__stack"><b>${esc(titles.get(d) || formatFullDate(d))}</b><small>${esc(formatFullDate(d))}</small></span>${d === s.activeStoryDate ? '<span class="ios-check">✓</span>' : ''}
    </button></li>`).join('');
  const scopeRow = (v, label) => `<li><button type="button" class="ios-row" data-action="set-scope" data-scope="${v}"><span class="ios-row__t">${label}</span>${s.scope === v ? '<span class="ios-check">✓</span>' : ''}</button></li>`;
  return `${nav('Date & Time')}<div class="ios-page ios-page--sub">
    <p class="ios-label">Story day</p>
    <ul class="ios-group">${rows}</ul>
    <p class="ios-label">Clock speed</p>
    <ul class="ios-group">${speedRow(1, 'Real time (1×)')}${speedRow(10, 'Fast (10×)')}${speedRow(60, 'Very fast (60×)')}</ul>
    <ul class="ios-group"><li><button type="button" class="ios-row" data-action="settings-pause"><span class="ios-row__t">Pause clock</span>${sw(isPaused())}</button></li></ul>
    <p class="ios-label">Show content</p>
    <ul class="ios-group">${scopeRow('day', 'Only this day')}${scopeRow('upto', 'Up to this day')}</ul>
  </div>`;
}

function render() {
  if (!root) return;
  const s = getState();
  const me = getCharacter(s.activeCharacterId);
  if (!me) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="ios-settings">${screen === 'apple-id' ? appleIdScreen(s, me) : screen === 'date' ? dateScreen(s) : screen === 'appearance' ? appearanceScreen() : rootScreen(s, me)}</div>`;
}

export function initSettingsApp() {
  root = $('#app-settings');
  if (!root) return;
  registerApp('settings', { root, render });

  registerAction('settings-go', (el) => go(el.dataset.screen));
  registerAction('settings-back', () => back());
  registerAction('settings-pick-char', (el) => setCharacter(el.dataset.id));
  registerAction('settings-pick-date', (el) => setDate(el.dataset.date));
  registerAction('settings-dnd', () => setDnd(!isDnd()));
  registerAction('settings-appearance', (el) => setAppearance(el.dataset.mode));
  registerAction('settings-speed', (el) => setSpeed(Number(el.dataset.speed)));
  registerAction('settings-pause', () => setPaused(!isPaused()));
  registerAction('settings-exit', () => { back(); navigate(''); });

  render();
  onStoreChange(render);
  onPrefs(render);
  subscribe((state, changed) => {
    if (changed.includes('activeApp') && state.activeApp !== 'settings' && screen !== 'root') back();
    else render();
  });
}
