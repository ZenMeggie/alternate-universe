// Landing: karakter, judul, tanggal, dan jumlah item semuanya dari Firestore (store.js).

import { getState, subscribe, setCharacter, setDate } from './state.js';
import {
  getPlayable, getCharacters, getCharacter, countsFor, onStoreChange, avatarHtml,
  getStoryMeta, getTimeline, isStoreReady, storeError,
} from './data/store.js';
import { icon } from './icons.js';
import { esc, $, formatWeekday, formatDayNumber, formatMonthShort, formatFullDate, plural } from './utils.js';
import { registerAction, navigate, setLandingSection } from './navigation.js';

const first = (c) => String(c?.name || '').split(' ')[0];
const timeline = () => getTimeline();
const getDay = (date) => timeline().find((d) => d.date === date) || null;

function portrait(c) {
  return c.avatar
    ? `<img src="${esc(c.avatar)}" alt="Portrait of ${esc(c.name)}" width="400" height="400" loading="eager" decoding="async">`
    : `<span class="avatar-fallback" style="display:grid;place-items:center;width:100%;aspect-ratio:1;background:${esc(c.accent)};color:#fff;font-size:64px;font-weight:700">${esc((c.name || '?')[0])}</span>`;
}

function characterCards(state) {
  if (!isStoreReady()) return '<p class="empty" role="status">Memuat karakter…</p>';
  const playable = getPlayable();
  if (!playable.length) {
    return `<p class="empty">${esc(storeError || 'Belum ada karakter yang bisa dipilih. Centang “Bisa dipilih di ponsel” di admin.')}</p>`;
  }
  return playable.map((c) => {
    const active = c.id === state.activeCharacterId;
    return `<article class="char-card ${active ? 'is-active' : ''}" style="--accent:${esc(c.accent)}">
      <div class="char-card__portrait">${portrait(c)}</div>
      <div class="char-card__body">
        <p class="eyebrow">${esc(c.tagline || c.role || c.about || '')}</p>
        <h3>${esc(c.name)}</h3>
        ${c.username ? `<p class="char-card__user">@${esc(c.username)}</p>` : ''}
        <p class="char-card__bio">${esc(c.bio || c.about || '')}</p>
        <button type="button" class="btn ${active ? 'btn--solid' : 'btn--ghost'}" data-action="pick-character" data-id="${esc(c.id)}" aria-pressed="${active}">
          ${active ? icon('check', 16) + ' Reading as ' + esc(first(c)) : 'Read as ' + esc(first(c))}
        </button>
      </div>
    </article>`;
  }).join('');
}

function supportingCast() {
  const cast = getCharacters().filter((c) => !c.playable);
  if (!cast.length) return '';
  return `<div class="cast" aria-label="Supporting characters">
    <p class="eyebrow">Also in this story</p>
    <ul>${cast.map((c) => `<li>${avatarHtml(c, 40)}<span><strong>${esc(c.name)}</strong><small>${esc(c.bio || c.about || '')}</small></span></li>`).join('')}</ul>
  </div>`;
}

function dateCards(state) {
  const me = first(getPlayable().find((c) => c.id === state.activeCharacterId));
  return timeline().map((day) => {
    const active = day.date === state.activeStoryDate;
    const probe = countsFor({ ...state, activeStoryDate: day.date });
    const total = probe.notes + probe.whatsapp + probe.gallery + probe.twitter;
    return `<button type="button" class="date-card ${active ? 'is-active' : ''}" data-action="pick-date" data-date="${esc(day.date)}" aria-pressed="${active}">
      <span class="date-card__cal"><small>${esc(formatMonthShort(day.date))}</small><b>${esc(formatDayNumber(day.date))}</b><small>${esc(formatWeekday(day.date).slice(0, 3))}</small></span>
      <span class="date-card__main">
        <span class="eyebrow">${esc(day.label || '')}</span>
        <strong>${esc(day.title || '')}</strong>
        <span class="date-card__sum">${esc(day.summary || '')}</span>
        <span class="date-card__meta">${icon('layers', 14)} ${esc(plural(total, 'item'))}${me ? ` for ${esc(me)}` : ''}</span>
      </span>
      <span class="date-card__go">${active ? icon('check', 18) : icon('chevronRight', 18)}</span>
    </button>`;
  }).join('');
}

function dateDetail(state) {
  const day = getDay(state.activeStoryDate);
  if (!day) return '';
  return `<div class="date-detail">
    <div>
      <p class="eyebrow">${esc(formatFullDate(day.date))}</p>
      <h3>${esc(day.title || '')}</h3>
      <ol class="date-events">${(day.events || []).map((e) => `<li><time>${esc(e.time || '')}</time><div><strong>${esc(e.title || '')}</strong><span>${esc(e.summary || '')}</span></div></li>`).join('')}</ol>
    </div>
    <button type="button" class="btn btn--solid btn--lg" data-action="nav" data-route="home">Open the phone ${icon('arrowRight', 18)}</button>
  </div>`;
}

/* ---------- wallpaper ponsel (dari characters/<id>.wallpaperUrl) ---------- */

function applyWallpaper() {
  const home = $('#view-home');
  if (!home) return;
  const url = getCharacter(getState().activeCharacterId)?.wallpaper || '';
  if (url) {
    home.style.setProperty('--wallpaper', `url("${url.replace(/["\\\n]/g, encodeURIComponent)}")`);
    home.classList.add('has-wallpaper');
  } else {
    home.style.removeProperty('--wallpaper');
    home.classList.remove('has-wallpaper');
  }
}

export function renderLanding() {
  applyWallpaper();
  if (!$('#view-landing')) return;
  const s = getState();
  const meta = getStoryMeta();
  $('#landing-cards').innerHTML = characterCards(s) + supportingCast();
  $('#landing-dates').innerHTML = dateCards(s);
  $('#landing-detail').innerHTML = dateDetail(s);
  $('#landing-title').textContent = meta.title || '';
  $('#landing-subtitle').textContent = meta.subtitle || '';
  if (meta.title) document.title = `${meta.title} · An AU Story`;
}

let observer = null;
function observeSections() {
  if (!('IntersectionObserver' in window)) return;
  const dates = $('#dates'), hero = $('#characters');
  if (!dates || !hero) return;
  observer?.disconnect();
  const visible = new Map();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) visible.set(e.target.id, e.intersectionRatio);
    setLandingSection((visible.get('dates') || 0) > (visible.get('characters') || 0) ? 'dates' : 'hero');
  }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
  observer.observe(hero);
  observer.observe(dates);
}

export function initLanding() {
  registerAction('pick-character', (el) => setCharacter(el.dataset.id));
  registerAction('pick-date', (el) => setDate(el.dataset.date));
  registerAction('scroll-dates', () => navigate('dates'));
  renderLanding();
  observeSections();
  onStoreChange(renderLanding);
  subscribe((_state, changed) => {
    if (changed.some((k) => k === 'activeCharacterId' || k === 'activeStoryDate')) renderLanding();
  });
}