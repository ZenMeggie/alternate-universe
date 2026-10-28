// Landing page: hero, character cards, and the date selector revealed by scrolling.

import { getState, subscribe, setCharacter, setDate } from './state.js';
import { characters, playableCharacters, storyMeta } from './data/characters.js';
import {
  getTimeline,
  getStoryMeta,
  onStoreChange,
} from './data/store.js';
import { icon } from './icons.js';
import { esc, $, $$, formatWeekday, formatDayNumber, formatMonthShort, formatFullDate, plural } from './utils.js';
import { registerAction, navigate, setLandingSection } from './navigation.js';
import { avatarImg } from './ui.js';
import { countsFor } from './selectors.js';

function characterCards(state) {
  return playableCharacters
    .map((c) => {
      const active = c.id === state.activeCharacterId;
      return `<article class="char-card ${active ? 'is-active' : ''}" style="--accent:${esc(c.accent)}">
        <div class="char-card__portrait"><img src="${esc(c.avatar)}" alt="Portrait of ${esc(c.name)}" width="400" height="400" loading="eager" decoding="async"></div>
        <div class="char-card__body">
          <p class="eyebrow">${esc(c.tagline)}</p>
          <h3>${esc(c.name)}</h3>
          <p class="char-card__user">@${esc(c.username)}</p>
          <p class="char-card__bio">${esc(c.bio)}</p>
          <button type="button" class="btn ${active ? 'btn--solid' : 'btn--ghost'}" data-action="pick-character" data-id="${esc(c.id)}" aria-pressed="${active}">
            ${active ? icon('check', 16) + ' Reading as ' + esc(c.name.split(' ')[0]) : 'Read as ' + esc(c.name.split(' ')[0])}
          </button>
        </div>
      </article>`;
    })
    .join('');
}

function supportingCast() {
  const cast = characters.filter((c) => !c.playable);
  if (!cast.length) return '';
  return `<div class="cast" aria-label="Supporting characters">
    <p class="eyebrow">Also in this story</p>
    <ul>${cast
      .map((c) => `<li>${avatarImg(c, 40)}<span><strong>${esc(c.name)}</strong><small>${esc(c.bio)}</small></span></li>`)
      .join('')}</ul>
  </div>`;
}

function dateCards(state) {
  const timeline = getTimeline();
  return timeline
    .map((day) => {
      const active = day.date === state.activeStoryDate;
      const probe = countsFor({ ...state, activeStoryDate: day.date });
      const total = probe.notes + probe.whatsapp + probe.gallery + probe.twitter;
      return `<button type="button" class="date-card ${active ? 'is-active' : ''}" data-action="pick-date" data-date="${esc(day.date)}" aria-pressed="${active}">
        <span class="date-card__cal"><small>${esc(formatMonthShort(day.date))}</small><b>${esc(formatDayNumber(day.date))}</b><small>${esc(formatWeekday(day.date).slice(0, 3))}</small></span>
        <span class="date-card__main">
          <span class="eyebrow">${esc(day.label)}</span>
          <strong>${esc(day.title)}</strong>
          <span class="date-card__sum">${esc(day.summary)}</span>
          <span class="date-card__meta">${icon('layers', 14)} ${esc(plural(total, 'item'))} for ${esc(characters.find((c) => c.id === state.activeCharacterId)?.name.split(' ')[0] || '')}</span>
        </span>
        <span class="date-card__go">${active ? icon('check', 18) : icon('chevronRight', 18)}</span>
      </button>`;
    })
    .join('');
}

function dateDetail(state) {
  const day = getTimeline().find(
    item => item.date === state.activeStoryDate
  );

  if (!day) return '';

  const events = Array.isArray(day.events) ? day.events : [];

  return `<div class="date-detail">
    <div>
      <p class="eyebrow">${esc(formatFullDate(day.date))}</p>
      <h3>${esc(day.title || day.label || day.date)}</h3>
      <ol class="date-events">${events
        .map(e => `<li>
          <time>${esc(e.time || '')}</time>
          <div>
            <strong>${esc(e.title || '')}</strong>
            <span>${esc(e.summary || '')}</span>
          </div>
        </li>`)
        .join('')}</ol>
    </div>
    <button type="button" class="btn btn--solid btn--lg"
      data-action="nav" data-route="home">
      Open the phone ${icon('arrowRight', 18)}
    </button>
  </div>`;
}

export function renderLanding() {
  const root = $('#view-landing');
  if (!root) return;
  const s = getState();
  const meta = getStoryMeta(storyMeta);

  $('#landing-cards').innerHTML = characterCards(s) + supportingCast();
  $('#landing-dates').innerHTML = dateCards(s);
  $('#landing-detail').innerHTML = dateDetail(s);
  $('#landing-title').textContent = meta.title;
  $('#landing-subtitle').textContent = meta.subtitle;
}

let observer = null;

function observeSections() {
  if (!('IntersectionObserver' in window)) return;
  const dates = $('#dates');
  const hero = $('#characters');
  if (!dates || !hero) return;
  observer?.disconnect();
  const visible = new Map();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.intersectionRatio);
      const section = (visible.get('dates') || 0) > (visible.get('characters') || 0) ? 'dates' : 'hero';
      setLandingSection(section);
    },
    { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
  );
  observer.observe(hero);
  observer.observe(dates);
}

export function initLanding() {
  let unsubscribeLandingStore = null;
  if (!unsubscribeLandingStore) {
    unsubscribeLandingStore = onStoreChange(() => {
      renderLanding();
    });
  }
  registerAction('pick-character', (el) => setCharacter(el.dataset.id));
  registerAction('pick-date', (el) => setDate(el.dataset.date));
  registerAction('scroll-dates', () => navigate('dates'));
  renderLanding();
  observeSections();
  subscribe((state, changed) => {
    if (changed.some((k) => k === 'activeCharacterId' || k === 'activeStoryDate')) renderLanding();
  });
}
