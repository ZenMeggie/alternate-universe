// Notes app: catatan karakter aktif dari Firestore, difilter tanggal cerita, dikelompokkan per folder.

import { getState, subscribe, consumeFocus } from '../state.js';
import { registerApp } from '../navigation.js';
import { startStore, onStoreChange, isStoreReady, storeError, notesFor, getCharacter, eventLinks, getEvent } from '../data/store.js';
import { icon } from '../icons.js';
import { esc, nl2br, formatStamp, formatFullStamp, truncate, groupBy, plural } from '../utils.js';
import { appTop, emptyState, scopeToggle, linkChips } from '../ui.js';

let root;
let openNoteId = null;

const safeLinks = (...args) => {
  try {
    return eventLinks(...args) || [];
  } catch {
    return [];
  }
};

function listHtml(state, notes) {
  if (!notes.length) {
    const name = (getCharacter(state.activeCharacterId)?.name || '').split(' ')[0];
    return emptyState({
      iconName: 'note',
      title: 'No notes here',
      text: `${name} didn't write anything ${state.scope === 'day' ? 'on this day' : 'up to this day'}.`,
      actionHtml: state.scope === 'day' ? `<button class="btn btn--ghost" data-action="set-scope" data-scope="upto">Show earlier notes</button>` : '',
    });
  }
  const groups = groupBy(notes, (n) => n.folder || 'Notes');
  return [...groups.entries()]
    .map(
      ([folder, items]) => `<section class="notes-group">
        <h2 class="notes-group__title">${icon('folder', 15)} ${esc(folder)} <small>${items.length}</small></h2>
        <ul class="notes-list">${items
          .map(
            (n) => `<li><button type="button" class="note-row ${n.id === openNoteId ? 'is-active' : ''}" data-action="open-note" data-id="${esc(n.id)}">
              <strong>${esc(n.title)}</strong>
              <span><time>${esc(formatStamp(n.updatedAt))}</time> ${esc(truncate(n.content || '', 60))}</span>
            </button></li>`
          )
          .join('')}</ul>
      </section>`
    )
    .join('');
}

function detailHtml(note) {
  if (!note) {
    return `<div class="note-detail note-detail--empty">${emptyState({ iconName: 'note', title: 'Select a note', text: 'Private thoughts, plans and secrets appear here.' })}</div>`;
  }
  const ev = note.eventId ? getEvent(note.eventId) : null;
  const links = ev ? safeLinks(note.eventId, note.characterId, { type: 'note', id: note.id }) : [];
  return `<article class="note-detail">
    <button type="button" class="note-back" data-action="close-note">${icon('chevronLeft', 16)} Notes</button>
    <p class="eyebrow">${icon('lock', 12)} ${esc(note.folder || 'Notes')} · ${esc(formatFullStamp(note.updatedAt))}</p>
    <h2>${esc(note.title)}</h2>
    <div class="note-detail__text">${nl2br(note.content || '')}</div>
    ${note.narrationId ? `<p><button type="button" class="btn btn--ghost" data-action="open-narration" data-id="${esc(note.narrationId)}">${icon('info', 16)} Story behind this note</button></p>` : ''}
    ${ev && links.length ? `<div class="related"><p class="eyebrow">Story moment: ${esc(ev.title)}</p>${linkChips(links)}</div>` : ''}
  </article>`;
}

export function renderNotes() {
  const state = getState();
  const notes = notesFor(state);
  if (state.focus && state.focus.type === 'note') {
    openNoteId = state.focus.id;
    consumeFocus();
  }
  if (!notes.some((n) => n.id === openNoteId)) openNoteId = null;
  const open = notes.find((n) => n.id === openNoteId) || null;

  const body = !isStoreReady()
    ? emptyState({ iconName: 'note', title: 'Loading…', text: 'Fetching notes.' })
    : storeError && !notes.length
      ? emptyState({ iconName: 'note', title: 'Could not load notes', text: storeError })
      : listHtml(state, notes);

  root.innerHTML = `
    ${appTop({ appId: 'notes', title: 'Notes', subtitle: plural(notes.length, 'note'), state, extra: scopeToggle(state.scope) })}
    <div class="notes ${open ? 'has-open' : ''}">
      <aside class="notes__list">${body}</aside>
      <section class="notes__detail">${detailHtml(open)}</section>
    </div>`;
}

export function initNotes(registerAction) {
  root = document.getElementById('app-notes');
  registerAction('open-note', (el) => {
    openNoteId = el.dataset.id;
    renderNotes();
  });
  registerAction('close-note', () => {
    openNoteId = null;
    renderNotes();
  });
  registerApp('notes', { root, render: renderNotes });
  startStore();
  renderNotes();
  subscribe(() => renderNotes());
  onStoreChange(() => renderNotes());
}
