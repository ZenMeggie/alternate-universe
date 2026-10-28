// Shared UI pieces: modals, empty states, scope toggle, link chips, app header.
// Narration modal ada di apps/narrationModal.js, reader cerita di apps/stories.js.

import { icon, brand, APP_META } from './icons.js';
import { esc, formatDayShort, initialsAvatar } from './utils.js';
import { getCharacter } from './data/store.js';

/* ---------- modal ---------- */

const modalStack = [];

export function openModal({ html, className = '', label = 'Dialog', onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${esc(className)}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <button class="modal__close" type="button" data-modal-close aria-label="Close">
        ${icon('close', 18)}
      </button>
      <div class="modal__body">${html}</div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.classList.add('has-modal');

  const previouslyFocused = document.activeElement;
  let closed = false;

  const entry = {
    el: backdrop,
    close() {
      if (closed) return;
      closed = true;
      backdrop.classList.remove('is-open');
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      if (!modalStack.length) document.body.classList.remove('has-modal');
      setTimeout(() => backdrop.remove(), 220);
      if (previouslyFocused?.focus) previouslyFocused.focus();
      if (onClose) onClose();
    },
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-modal-close]')) entry.close();
  });

  modalStack.push(entry);
  requestAnimationFrame(() => backdrop.classList.add('is-open'));
  backdrop.querySelector('.modal__close')?.focus({ preventScroll: true });
  return entry;
}

/** Closes the top-most modal. Returns true if there was one. */
export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/* ---------- small building blocks ---------- */

export const avatarImg = (character, size = 40, className = '') =>
  `<img
    class="avatar ${className}"
    src="${esc(character?.avatar || initialsAvatar(character?.name || '?'))}"
    data-name="${esc(character?.name || '?')}"
    alt=""
    width="${size}"
    height="${size}"
    loading="lazy"
    decoding="async"
  >`;

// Broken images degrade gracefully.
document.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;

    if (img.classList.contains('sticker')) {
      const box = document.createElement('span');
      box.className = 'sticker-fallback';
      box.textContent = img.dataset.label || 'Sticker';
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', img.alt || 'Sticker');
      img.replaceWith(box);
    } else if (img.classList.contains('avatar') && !img.dataset.fallback) {
      img.dataset.fallback = '1';
      img.src = initialsAvatar(img.dataset.name || '?');
    }
  },
  true
);

export function emptyState({ iconName = 'sparkle', title, text = '', actionHtml = '' }) {
  return `
    <div class="empty">
      <span class="empty__icon">${icon(iconName, 28)}</span>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${actionHtml}
    </div>`;
}

export const scopeToggle = (scope) => `
  <div class="segmented" role="group" aria-label="Which days to show">
    <button type="button" class="segmented__btn ${scope === 'day' ? 'is-active' : ''}" data-action="set-scope" data-scope="day" aria-pressed="${scope === 'day'}">This day</button>
    <button type="button" class="segmented__btn ${scope === 'upto' ? 'is-active' : ''}" data-action="set-scope" data-scope="upto" aria-pressed="${scope === 'upto'}">Up to this day</button>
  </div>`;

export const povBadge = (character) => `
  <span class="pov-badge" title="Notes and Gallery follow the account selected in WhatsApp or X, or in the profile menu">
    ${avatarImg(character, 22)}
    <span>POV: ${esc((character?.name || '?').split(' ')[0])}</span>
  </span>`;

export function appTop({ appId, title, subtitle, state, extra = '' }) {
  const character = getCharacter(state.activeCharacterId);
  return `
    <header class="app-top">
      <div class="app-top__title">
        <span class="app-tile app-tile--sm">${APP_META[appId].tile}</span>
        <div>
          <h1>${esc(title)}</h1>
          <p>${esc(subtitle)} · ${esc(formatDayShort(state.activeStoryDate))}</p>
        </div>
      </div>
      <div class="app-top__right">
        ${extra}${povBadge(character)}
      </div>
    </header>`;
}

const TYPE_ICON = {
  note: () => icon('note', 15),
  message: () => icon('comment', 15),
  photo: () => icon('image', 15),
  tweet: () => brand('x', 13),
};

/** Chips that jump to related content in another app. */
export function linkChips(links) {
  if (!links.length) return '';
  return `
    <div class="chips">
      ${links.map((link) => `
        <button type="button" class="chip chip--link" data-action="open-related" data-type="${esc(link.type)}" data-id="${esc(link.id)}" title="${esc(link.label)}">
          ${TYPE_ICON[link.type]()}
          <span>${esc(link.label)}</span>
        </button>`).join('')}
    </div>`;
}