// Navigation: hash routes, floating "island" bar, character menu, app open/close transitions,
// dan satu delegated click handler untuk semua data-action.
//
//   #/            landing      #/home   home screen
//   #/dates       landing, scroll ke dates      #/app/<id>  sebuah app

import { getState, setState, subscribe, setCharacter, setDate, stepDate, canStep, setScope } from './state.js';
import { getPlayable, getCharacter, findContent, getDay } from './data/store.js';
import { icon, APP_META } from './icons.js';
import { esc, $, formatDayShort, prefersReducedMotion } from './utils.js';
import { closeTopModal, avatarImg } from './ui.js';

const apps = new Map(); // id -> { root, render }
const actions = new Map(); // data-action name -> handler(el, event)

let switcherOpen = false;
let landingSection = 'hero'; // 'hero' | 'dates'

export function registerApp(id, definition) {
  apps.set(id, definition);
}

export const getApp = (id) => apps.get(id);

export function registerAction(name, handler) {
  actions.set(name, handler);
}

/* ---------- routing ---------- */

export function currentRoute() {
  return location.hash.replace(/^#\/?/, '');
}

export function navigate(route = '') {
  const target = route ? `#/${route}` : '#/';
  if (currentRoute() !== route) {
    try {
      history.pushState(null, '', target);
    } catch {
      location.hash = target;
    }
  }
  applyRoute();
}

export function applyRoute() {
  const route = currentRoute();
  switcherOpen = false;
  if (route.startsWith('app/') && apps.has(route.slice(4))) {
    setState({ view: 'home', activeApp: route.slice(4) });
  } else if (route === 'home') {
    setState({ view: 'home', activeApp: null });
  } else {
    setState({ view: 'landing', activeApp: null });
  }
  renderNav();
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    if (route === 'dates') {
      const dates = $('#dates');
      if (dates) dates.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: route === '' || route === 'home' ? 'auto' : behavior });
    }
  });
}

export function openApp(id) {
  navigate(`app/${id}`);
}

/**
 * Lompat ke konten di app tempatnya. Set POV pemilik dan hari item supaya tujuan pasti memuatnya,
 * lalu minta app membuka/menyorotnya lewat state.focus.
 */
export function openRelated(type, id) {
  const found = findContent(type, id);
  if (!found) return false;
  setState({
    activeCharacterId: found.characterId,
    activeStoryDate: found.date,
    focus: { type, id, nonce: Date.now() },
    view: 'home',
    activeApp: found.app,
  });
  navigate(`app/${found.app}`);
  return true;
}

export function setLandingSection(section) {
  if (landingSection !== section) {
    landingSection = section;
    renderNav();
  }
}

/* ---------- views & app transitions ---------- */

function showView(el, show) {
  if (!el) return;
  if (show) {
    const wasHidden = el.hidden;
    el.hidden = false;
    if (wasHidden) {
      el.classList.remove('is-active');
      void el.offsetWidth; // restart entrance animation
    }
    el.classList.add('is-active');
  } else {
    el.classList.remove('is-active');
    el.hidden = true;
  }
}

function setAppOpen(root, open) {
  clearTimeout(root._closeTimer);
  if (open) {
    if (!root.hidden && root.classList.contains('is-open')) return;
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('is-open');
  } else if (root.classList.contains('is-open')) {
    root.classList.remove('is-open');
    if (prefersReducedMotion()) root.hidden = true;
    else root._closeTimer = setTimeout(() => (root.hidden = true), 340);
  }
}

export function renderViews() {
  const s = getState();
  showView($('#view-landing'), s.view === 'landing');
  showView($('#view-home'), s.view === 'home');
  let anyOpen = false;
  for (const [id, { root }] of apps) {
    const open = s.view === 'home' && s.activeApp === id;
    anyOpen = anyOpen || open;
    setAppOpen(root, open);
  }
  $('#app-layer')?.classList.toggle('is-open', anyOpen);
  $('#view-home')?.classList.toggle('is-covered', anyOpen);
  document.body.classList.toggle('no-scroll', anyOpen);
  document.body.dataset.view = s.view;
  document.body.dataset.app = s.activeApp || '';
}

/* ---------- floating navigation ---------- */

export function renderNav() {
  const nav = $('#floating-nav');
  if (!nav) return;
  const s = getState();
  const character = getCharacter(s.activeCharacterId);
  if (!character) {
    nav.innerHTML = '';
    return;
  }
  const day = getDay(s.activeStoryDate);
  const inApp = s.view === 'home' && s.activeApp;
  const onHome = s.view === 'home' && !s.activeApp;

  const profile = `<button type="button" class="fnav__profile" data-action="toggle-switcher" aria-haspopup="true" aria-expanded="${switcherOpen}" aria-label="Switch character. Currently ${esc(character.name)}">
      <span class="fnav__user">${icon('user', 18)}</span><span class="fnav__name">${esc(character.name.split(' ')[0])}</span>${icon('chevronDown', 14)}
    </button>`;

  let middle;
  
  if (inApp) {
    const meta = APP_META[s.activeApp];

    middle = `<button type="button" class="fnav__btn" data-action="nav" data-route="home" aria-label="Back to home screen">${icon('chevronLeft', 18)}<span class="fnav__label">Home</span></button>
      <span class="fnav__app"><span class="app-tile app-tile--xs">${meta?.tile ?? ''}</span><strong>${esc(meta?.title ?? s.activeApp)}</strong></span>`;
  } else {

    const item = (route, name, iconHtml, active) =>
      `<button type="button" class="fnav__btn ${active ? 'is-active' : ''}" data-action="nav" data-route="${route}" ${active ? 'aria-current="page"' : ''} aria-label="${name}">${iconHtml}<span class="fnav__label">${name}</span></button>`;
    middle =
      item('', 'Characters', icon('users', 18), s.view === 'landing' && landingSection === 'hero') +
      item('dates', 'Dates', icon('calendar', 18), s.view === 'landing' && landingSection === 'dates') +
      item('home', 'Home', icon('grid', 18), onHome);
  }

  const stepper = `<div class="fnav__date" role="group" aria-label="Story date">
      <button type="button" class="fnav__step" data-action="date-prev" aria-label="Previous day" ${canStep(-1) ? '' : 'disabled'}>${icon('chevronLeft', 16)}</button>
      <button type="button" class="fnav__stamp" data-action="nav" data-route="dates" aria-label="Choose a date. Currently ${esc(formatDayShort(s.activeStoryDate))}"><span class="fnav__daylabel">${esc(day ? day.label : '')}</span><span>${esc(formatDayShort(s.activeStoryDate))}</span></button>
      <button type="button" class="fnav__step" data-action="date-next" aria-label="Next day" ${canStep(1) ? '' : 'disabled'}>${icon('chevronRight', 16)}</button>
    </div>`;

  const switcher = `<div class="switcher" role="menu" ${switcherOpen ? '' : 'hidden'}>
      <p class="switcher__title">Read as…</p>
      ${getPlayable()
        .map(
          (c) => `<button type="button" role="menuitemradio" aria-checked="${c.id === s.activeCharacterId}" class="switcher__item ${c.id === s.activeCharacterId ? 'is-active' : ''}" data-action="set-character" data-id="${esc(c.id)}">
            ${avatarImg(c, 36)}<span><strong>${esc(c.name)}</strong><small>@${esc(c.username)}</small></span>${c.id === s.activeCharacterId ? icon('check', 16) : ''}
          </button>`
        )
        .join('')}
      <p class="switcher__hint">WhatsApp and X also let you switch accounts. Notes and Gallery always follow.</p>
    </div>`;

  nav.innerHTML = `${profile}<div class="fnav__middle">${middle}</div>${stepper}${switcher}`;
  nav.classList.toggle('is-in-app', Boolean(inApp));
}

/* ---------- delegated actions ---------- */

function registerCoreActions() {
  registerAction('nav', (el) => navigate(el.dataset.route || ''));
  registerAction('open-app', (el) => openApp(el.dataset.app));
  registerAction('toggle-switcher', () => {
    switcherOpen = !switcherOpen;
    renderNav();
  });
  registerAction('set-character', (el) => {
    switcherOpen = false;
    if (!setCharacter(el.dataset.id)) renderNav();
  });
  registerAction('date-prev', () => stepDate(-1));
  registerAction('date-next', () => stepDate(1));
  registerAction('set-date', (el) => setDate(el.dataset.date));
  registerAction('set-scope', (el) => setScope(el.dataset.scope));
  registerAction('open-related', (el) => {
    closeTopModal();
    openRelated(el.dataset.type, el.dataset.id);
  });
}

export function initNavigation() {
  registerCoreActions();

  document.addEventListener('click', (event) => {
    if (switcherOpen && !event.target.closest('#floating-nav')) {
      switcherOpen = false;
      renderNav();
    }
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const handler = actions.get(el.dataset.action);
    if (handler) handler(el, event);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (switcherOpen) {
      switcherOpen = false;
      renderNav();
      return;
    }
    if (closeTopModal()) return;
    const s = getState();
    if (s.view === 'home' && s.activeApp) navigate('home');
  });

  window.addEventListener('popstate', applyRoute);

  subscribe((state, changed) => {
    if (changed.includes('view') || changed.includes('activeApp')) renderViews();
    renderNav();
  });
  renderViews();
  renderNav();
}