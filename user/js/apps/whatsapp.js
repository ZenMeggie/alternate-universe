// WhatsApp (gaya iOS, mode terang): daftar chat, percakapan, tab Calls & Settings (ganti akun),
// stiker, foto, info kontak/grup, dan narasi pesan (ⓘ).

import { getState, subscribe, consumeFocus } from '../state.js';
import { registerApp } from '../navigation.js';
import { startStore, onStoreChange, isStoreReady, storeError, chatsFor, getPlayable, getCharacter, getSticker, avatarHtml } from '../data/store.js';
import { icon } from '../icons.js';
import { esc, formatTime, formatDayLong, formatDayMonth, dateKey, truncate } from '../utils.js';
import { emptyState, openModal } from '../ui.js';
import { openNarration } from './narrationModal.js';

let root;
let openChatId = null;
let highlightMessageId = null;
let tab = 'chats'; // 'status' | 'calls' | 'communities' | 'chats' | 'settings'

const firstName = (id) => String(getCharacter(id)?.name || id).split(' ')[0];

/* ---------- ikon (inline, supaya tidak bergantung pada icons.js) ---------- */

const svg = (body, size = 24, sw = 1.7) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const I = {
  camera: (s = 24) => svg('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>', s),
  compose: (s = 24) => svg('<path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M18.5 3.5l2 2L11 15l-3 1 1-3z"/>', s),
  search: (s = 16) => svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>', s, 2),
  video: (s = 24) => svg('<rect x="3" y="6" width="12" height="12" rx="2.5"/><path d="M15 10.5l6-3.5v10l-6-3.5"/>', s),
  phone: (s = 24) => svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>', s),
  plus: (s = 24) => svg('<path d="M12 5v14M5 12h14"/>', s),
  mic: (s = 24) => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', s),
  back: (s = 26) => svg('<path d="M15 5l-7 7 7 7"/>', s, 2.2),
  status: (s = 26) => svg('<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="4"/>', s),
  calls: (s = 26) => svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>', s),
  communities: (s = 26) => svg('<circle cx="12" cy="8" r="3"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M6.5 19a5.5 5.5 0 0 1 11 0M2.5 17a3.5 3.5 0 0 1 4-3M21.5 17a3.5 3.5 0 0 0-4-3"/>', s),
  chats: (s = 26) => svg('<path d="M12 4C7 4 3.5 7.2 3.5 11.2c0 2 1 3.8 2.5 5.1L5.2 20l3.6-1.7c1 .3 2 .4 3.2.4 5 0 8.5-3.2 8.5-7.2S17 4 12 4z"/>', s),
  settings: (s = 26) => svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>', s),
  check: (s = 20) => svg('<path d="M5 12.5l4.5 4.5L19 7"/>', s, 2.4),
  image: (s = 14) => svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', s),
};

/* ---------- helper ---------- */

const isCall = (m) => m.type === 'call' || m.type === 'missed_call';
const isImage = (m) => m.type === 'image' || (!!m.image && !m.stickerId && !isCall(m));

/** Durasi: angka = detik → mm:ss; teks dipakai apa adanya. */
function fmtDur(d) {
  if (d == null || d === '') return '';
  const n = Number(d);
  if (Number.isFinite(n)) return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.round(n % 60)).padStart(2, '0')}`;
  return String(d);
}

const kindOf = (m) => (m.callKind === 'video' ? 'video' : 'voice');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function callTitle(m, mine) {
  const k = cap(kindOf(m));
  if (m.type === 'missed_call') return mine ? `${k} call` : `Missed ${kindOf(m)} call`;
  return `${k} call`;
}

function callSub(m, mine) {
  if (m.type === 'missed_call') return mine ? 'No answer' : 'Missed';
  const dur = fmtDur(m.duration);
  if (!mine && !dur) return 'Incoming · tap to answer';
  return `${mine ? 'Outgoing' : 'Incoming'}${dur ? ` · ${dur}` : ''}`;
}

/** Jam untuk hari cerita aktif, "Yesterday" untuk sehari sebelumnya, selain itu tanggal. */
function rowTime(ts, state) {
  const day = dateKey(ts);
  if (!day || day === state.activeStoryDate) return formatTime(ts);
  const prev = state.activeStoryDate ? dateKey(new Date(`${state.activeStoryDate}T12:00:00+07:00`).getTime() - 86400000) : '';
  return day === prev ? 'Yesterday' : formatDayMonth(day);
}

/* ---------- tampilan: daftar ---------- */

function previewHtml(chat) {
  const m = chat.last;
  const mine = m.senderId === chat.characterId;
  const group = chat.contact.isGroup;
  const who = group ? `${mine ? 'You' : esc(firstName(m.senderId))}: ` : '';
  const tick = !group && mine ? icon('doubleCheck', 15, { className: 'ticks' }) : '';
  if (isCall(m)) return `${tick}${who}${I.phone(14)} ${esc(callTitle(m, mine))}`;
  if (isImage(m)) return `${tick}${who}${I.image(14)} ${esc(m.text ? truncate(m.text, 40) : 'Photo')}`;
  const sticker = m.stickerId ? `${icon('image', 14)} Sticker${m.text ? ' · ' : ''}` : '';
  return `${tick}${who}${sticker}${esc(truncate(m.text || '', 48))}`;
}

function chatRow(chat, state) {
  const missed = chat.last.type === 'missed_call' && chat.last.senderId !== chat.characterId;
  return `<li><button type="button" class="wi-row" data-action="open-chat" data-id="${esc(chat.id)}">
    ${avatarHtml(chat.contact, 52)}
    <span class="wi-row__body">
      <span class="wi-row__top"><strong>${esc(chat.contact.name)}</strong><time>${esc(rowTime(chat.last.timestamp, state))}</time></span>
      <span class="wi-row__sub ${missed ? 'is-missed' : ''}">${previewHtml(chat)}</span>
    </span>
  </button></li>`;
}

function chatsTab(chats, state, me) {
  const list = !isStoreReady()
    ? emptyState({ iconName: 'comment', title: 'Loading…', text: 'Fetching chats.' })
    : storeError && !chats.length
      ? emptyState({ iconName: 'comment', title: 'Could not load chats', text: storeError })
      : chats.length
        ? `<ul class="wi-list">${chats.map((c) => chatRow(c, state)).join('')}</ul>`
        : emptyState({ iconName: 'comment', title: 'No chats yet', text: `${String(me?.name || '').split(' ')[0]} hasn't sent or received any messages by this day.` });
  return `<h1 class="wi-title">Chats</h1>
    <div class="wi-search">${I.search()}<span>Ask Meta AI or Search</span></div>
    <div class="wi-links"><span>Broadcast Lists</span><span>New Group</span></div>
    ${list}`;
}

function callsTab(chats, state) {
  const calls = chats
    .flatMap((chat) => chat.messages.filter(isCall).map((m) => ({ m, chat })))
    .sort((a, b) => String(b.m.timestamp).localeCompare(String(a.m.timestamp)));
  const rows = calls.length
    ? `<ul class="wi-list">${calls.map(({ m, chat }) => {
        const mine = m.senderId === chat.characterId;
        const missed = m.type === 'missed_call' && !mine;
        const ring = !mine && m.type === 'call';
        const act = ring ? `data-action="open-call" data-id="${esc(m.id)}"` : `data-action="open-chat" data-id="${esc(chat.id)}"`;
        return `<li><button type="button" class="wi-row" ${act}>
          ${avatarHtml(chat.contact, 52)}
          <span class="wi-row__body">
            <span class="wi-row__top"><strong class="${missed ? 'is-missed' : ''}">${esc(chat.contact.name)}</strong><time>${esc(rowTime(m.timestamp, state))}</time></span>
            <span class="wi-row__sub ${missed ? 'is-missed' : ''}">${kindOf(m) === 'video' ? I.video(15) : I.phone(14)} ${esc(callSub(m, mine))}</span>
          </span>
        </button></li>`;
      }).join('')}</ul>`
    : emptyState({ iconName: 'comment', title: 'No recent calls', text: 'Calls made or received by this day will show up here.' });
  return `<h1 class="wi-title">Calls</h1>${rows}`;
}

function settingsTab(state) {
  return `<h1 class="wi-title">Settings</h1>
    <p class="wi-label">Switch account</p>
    <ul class="wi-accounts">${getPlayable().map((c) => {
      const on = c.id === state.activeCharacterId;
      return `<li><button type="button" class="wi-account ${on ? 'is-on' : ''}" data-action="set-character" data-id="${esc(c.id)}" aria-pressed="${on}">
        ${avatarHtml(c, 44)}
        <span><strong>${esc(c.name)}</strong><small>${esc(c.phone || '')}</small></span>
        ${on ? `<span class="wi-account__check">${I.check()}</span>` : ''}
      </button></li>`;
    }).join('')}</ul>`;
}

function placeholderTab(title, text) {
  return `<h1 class="wi-title">${esc(title)}</h1>${emptyState({ iconName: 'comment', title: 'Not part of this story', text })}`;
}


function tabBar() {
  const items = [
    ['status', 'Status'],
    ['calls', 'Calls'],
    ['communities', 'Communities'],
    ['chats', 'Chats'],
    ['settings', 'Settings'],
  ];

  return `<nav class="wi-tabs" aria-label="WhatsApp">
    ${items.map(([id, label]) => `
      <button
        type="button"
        class="wi-tab ${tab === id ? 'is-on' : ''}"
        data-action="wa-tab"
        data-tab="${id}"
        aria-current="${tab === id ? 'page' : 'false'}"
      >
        ${(I[id] || I.chats)()}
        <span>${label}</span>
      </button>
    `).join('')}
  </nav>`;
}

function listView(chats, state, me) {
  const body = tab === 'calls' ? callsTab(chats, state)
    : tab === 'settings' ? settingsTab(state)
    : tab === 'status' ? placeholderTab('Updates', 'Status updates are not available here.')
    : tab === 'communities' ? placeholderTab('Communities', 'Communities are not available here.')
    : chatsTab(chats, state, me);
  return `<div class="wi">
    <header class="wi-top">
      <span class="wi-edit">Edit</span>
      <span class="wi-icons">${I.camera()}${I.compose()}</span>
    </header>
    <div class="wi-scroll">${body}</div>
    ${tabBar()}
  </div>`;
}

/* ---------- tampilan: percakapan ---------- */

/** Stiker; file rusak/kosong diganti placeholder oleh handler di ui.js. */
function stickerHtml(stickerId) {
  const sticker = getSticker(stickerId);
  if (!sticker) return `<span class="sticker-fallback" role="img" aria-label="Sticker">Sticker</span>`;
  return `<img class="sticker wi-sticker" src="${esc(sticker.file)}" alt="Sticker: ${esc(sticker.label)}" data-label="${esc(sticker.label)}" loading="lazy" decoding="async">`;
}

/** Foto kiriman; klik untuk melihat ukuran penuh. */
function photoHtml(m) {
  if (!m.image) return `<span class="sticker-fallback" role="img" aria-label="Photo">Photo</span>`;
  return `<button type="button" class="wi-photo" data-action="open-wa-photo" data-src="${esc(m.image)}" aria-label="View photo"><img class="wi-photo__img" src="${esc(m.image)}" alt="Photo" loading="lazy" decoding="async"></button>`;
}

function bubble(m, chat) {
  const mine = m.senderId === chat.characterId;
  const group = chat.contact.isGroup;
  const sender = group && !mine ? getCharacter(m.senderId) : null;
  const stickerOnly = m.stickerId && !m.text;
  const call = isCall(m);
  const photo = isImage(m);
  const ringable = call && !mine && m.type === 'call';
  const missed = call && m.type === 'missed_call' && !mine;
  const cls = ['wi-msg', mine ? 'wi-msg--out' : 'wi-msg--in', stickerOnly ? 'wi-msg--sticker' : '', photo ? 'wi-msg--photo' : '', m.id === highlightMessageId ? 'is-highlight' : ''];

  const callRow = call
    ? `<div class="wi-callrow ${missed ? 'is-missed' : ''} ${ringable ? 'is-ring' : ''}" ${ringable ? `role="button" tabindex="0" data-action="open-call" data-id="${esc(m.id)}"` : ''}>
        <span class="wi-callrow__ico">${kindOf(m) === 'video' ? I.video(18) : I.phone(17)}</span>
        <span class="wi-callrow__txt"><strong>${esc(callTitle(m, mine))}</strong><small>${esc(callSub(m, mine))}</small></span>
      </div>`
    : '';

  return `<div class="${cls.filter(Boolean).join(' ')}" id="msg-${esc(m.id)}">
    <div class="wi-bubble">
      ${sender ? `<span class="wi-name" style="color:${esc(sender.accent || '#128c7e')}">${esc(sender.name)}</span>` : ''}
      ${callRow}
      ${photo ? photoHtml(m) : ''}
      ${m.stickerId && !call && !photo ? stickerHtml(m.stickerId) : ''}
      ${m.text ? `<p class="wi-text">${esc(m.text)}</p>` : ''}
      <span class="wi-meta">
        ${m.narrationId ? `<button type="button" class="wi-narr" data-action="open-narration" data-id="${esc(m.narrationId)}" aria-label="Read the story behind this message" title="Story behind this message">${icon('info', 15)}</button>` : ''}
        <time>${esc(formatTime(m.timestamp))}</time>${mine ? icon('doubleCheck', 15, { className: 'ticks' }) : ''}
      </span>
    </div>
  </div>`;
}

function conversationView(chat) {
  const contact = chat.contact;
  let lastDay = '';
  const bubbles = chat.messages
    .map((m) => {
      const day = dateKey(m.timestamp);
      const sep = day && day !== lastDay ? `<div class="wi-day"><span>${esc(formatDayLong(day))}</span></div>` : '';
      lastDay = day;
      return sep + bubble(m, chat);
    })
    .join('');
  const subtitle = contact.isGroup
    ? ['You', ...contact.members.filter((c) => c.id !== chat.characterId).map((c) => String(c.name).split(' ')[0])].join(', ')
    : 'tap here for contact info';
  return `<div class="wi wi--conv">
    <header class="wi-head">
      <button type="button" class="wi-back" data-action="close-chat" aria-label="Back to chats">${I.back()}</button>
      <button type="button" class="wi-contact" data-action="${contact.isGroup ? 'open-group' : 'open-contact'}" data-id="${esc(contact.isGroup ? chat.id : contact.id)}">
        ${avatarHtml(contact, 36)}<span><strong>${esc(contact.name)}</strong><small>${esc(subtitle)}</small></span>
      </button>
      <span class="wi-head__icons">${I.video()}${I.phone()}</span>
    </header>
    <div class="wi-chat" id="conv-scroll">${bubbles}</div>
    <div class="wi-compose" aria-hidden="true">
      ${I.plus(26)}
      <span class="wi-compose__field"></span>
      ${I.camera(24)}${I.mic(24)}
    </div>
  </div>`;
}

/* ---------- render ---------- */

export function renderWhatsApp() {
  const state = getState();
  const chats = chatsFor(state);
  const me = getCharacter(state.activeCharacterId);

  if (state.focus && state.focus.type === 'message') {
    const target = chats.find((c) => c.messages.some((m) => m.id === state.focus.id));
    if (target) {
      openChatId = target.id;
      highlightMessageId = state.focus.id;
      tab = 'chats';
    }
    consumeFocus();
  }
  if (!chats.some((c) => c.id === openChatId)) {
    openChatId = null;
    highlightMessageId = null;
  }
  const chat = chats.find((c) => c.id === openChatId) || null;

  root.innerHTML = chat ? conversationView(chat) : listView(chats, state, me);

  const scroll = root.querySelector('#conv-scroll');
  if (scroll) {
    const target = highlightMessageId && root.querySelector(`#msg-${CSS.escape(highlightMessageId)}`);
    if (target) target.scrollIntoView({ block: 'center' });
    else scroll.scrollTop = scroll.scrollHeight;
    // Gambar selesai dimuat setelah layout; tetap tampilkan pesan terbaru.
    if (!target) scroll.querySelectorAll('img.sticker, img.wi-photo__img').forEach((img) => img.addEventListener('load', () => (scroll.scrollTop = scroll.scrollHeight), { once: true }));
  }
}

/* ---------- modal ---------- */

function contactModal(id) {
  const c = getCharacter(id);
  if (!c) return;
  openModal({
    className: 'modal--contact',
    label: `Contact info for ${c.name}`,
    html: `<div class="contact">
      ${avatarHtml(c, 96, 'avatar--xl')}
      <h2>${esc(c.name)}</h2>
      ${c.username ? `<p class="contact__user">@${esc(c.username)}</p>` : ''}
      <p class="contact__about">${esc(c.about || '')}</p>
      <dl><dt>${icon('phone', 14)} Phone</dt><dd>${esc(c.phone || '-')}</dd><dt>${icon('pin', 14)} Area</dt><dd>${esc(c.location || '-')}</dd><dt>${icon('info', 14)} Bio</dt><dd>${esc(c.bio || '-')}</dd></dl>
    </div>`,
  });
}

function groupModal(chatId) {
  const state = getState();
  const chat = chatsFor(state).find((c) => c.id === chatId);
  if (!chat) return;
  const g = chat.contact;
  openModal({
    className: 'modal--contact modal--group',
    label: `Group info for ${g.name}`,
    html: `<div class="contact">
      ${avatarHtml(g, 96, 'avatar--xl')}
      <h2>${esc(g.name)}</h2>
      <p class="contact__user">Group · ${g.members.length} participants</p>
      ${g.description ? `<p class="contact__about">${esc(g.description)}</p>` : ''}
      <ul class="members">${g.members
        .map((m) => `<li>${avatarHtml(m, 40)}<span><strong>${esc(m.name)}${m.id === chat.characterId ? ' <em>(You)</em>' : ''}</strong><small>${esc(m.bio || '')}</small></span></li>`)
        .join('')}</ul>
    </div>`,
  });
}

function photoModal(src) {
  if (!src) return;
  openModal({
    className: 'modal--photo',
    label: 'Photo',
    html: `<img src="${esc(src)}" alt="Photo" style="display:block;max-width:100%;max-height:80vh;margin:0 auto;border-radius:8px">`,
  });
}

/* ---------- style tambahan (elemen baru) ---------- */

function injectStyle() {
  if (document.getElementById('wi-extra-style')) return;
  const s = document.createElement('style');
  s.id = 'wi-extra-style';
  s.textContent = `
.wi-msg--photo .wi-bubble{width:min(250px,78%) !important;padding:3px 3px 6px !important;box-sizing:border-box}
.wi-photo{display:block;width:100%;max-width:none;padding:0;margin:0 0 4px;border:0;background:none;cursor:pointer;border-radius:8px;overflow:hidden}
.wi-photo__img{display:block;width:100%;height:auto;max-height:360px;object-fit:cover;object-position:top;border-radius:8px}
.wi-msg--photo .wi-text,.wi-msg--photo .wi-name{padding:0 6px}
.wi-msg--photo .wi-meta{padding:0 6px}`;
  document.head.appendChild(s);
}

/* ---------- init ---------- */

export function initWhatsApp(registerAction) {
  root = document.getElementById('app-whatsapp');
  injectStyle();
  registerAction('open-chat', (el) => {
    openChatId = el.dataset.id;
    highlightMessageId = null;
    tab = 'chats';
    renderWhatsApp();
  });
  registerAction('close-chat', () => {
    openChatId = null;
    highlightMessageId = null;
    renderWhatsApp();
  });
  registerAction('wa-tab', (el) => {
    tab = el.dataset.tab || 'chats';
    renderWhatsApp();
  });
  registerAction('open-narration', (el) => openNarration(el.dataset.id));
  registerAction('open-contact', (el) => contactModal(el.dataset.id));
  registerAction('open-group', (el) => groupModal(el.dataset.id));
  registerAction('open-wa-photo', (el) => photoModal(el.dataset.src));
  registerApp('whatsapp', { root, render: renderWhatsApp });
  startStore();
  renderWhatsApp();
  subscribe(() => renderWhatsApp());
  onStoreChange(() => renderWhatsApp());
}