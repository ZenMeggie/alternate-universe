// apps/narrationModal.js — pengganti openNarration (ui.js) yang membaca narasi dari Firestore
// dan menampilkan cuplikan chat yang terjadi saat narasi itu.

import { openModal } from '../ui.js';
import { esc, nl2br, formatFullStamp, formatTime } from '../utils.js';
import { icon } from '../icons.js';
import { getNarration, getMessageContext, getCharacter, chatName } from '../data/store.js';

function callLabel(m, mine) {
  const kind = m.callKind === 'video' ? 'video' : 'voice';
  if (m.type === 'missed_call') return mine ? `${kind} call · no answer` : `Missed ${kind} call`;
  return `${mine ? 'Outgoing' : 'Incoming'} ${kind} call${m.duration ? ` · ${m.duration}` : ''}`;
}

function chatExcerpt(ctx, ownerId) {
  if (!ctx || !ctx.messages.length) return '';
  const rows = ctx.messages
    .map((m) => {
      const mine = m.senderId === ownerId;
      const focus = m.id === ctx.focusId ? ' style="outline:2px solid currentColor;outline-offset:2px"' : '';
      let body;
      if (m.type === 'sticker') body = `${icon('image', 13)} Sticker`;
      else if (m.type === 'call' || m.type === 'missed_call') body = `${icon('phone', 13)} ${esc(callLabel(m, mine))}`;
      else body = esc(m.text);
      const who = !mine ? `<strong>${esc(getCharacter(m.senderId)?.name.split(' ')[0] || m.senderId)}</strong> ` : '';
      return `<span class="sc-msg ${mine ? 'sc-msg--out' : 'sc-msg--in'}"${focus}>${who}${body} <small>${esc(formatTime(m.timestamp))}</small></span>`;
    })
    .join('');
  return `<div class="sc-chat">
    <div class="sc-chat__head"><span class="sc-chat__dot" aria-hidden="true"></span>WhatsApp · ${esc(chatName(ctx.chat, ownerId))}</div>
    <div class="sc-chat__body"><div class="sc-chat__group">${rows}</div></div>
  </div>`;
}

export function openNarration(id) {
  const n = getNarration(id);
  if (!n) return;
  const who = getCharacter(n.characterId);
  const ctx = n.related.messageId ? getMessageContext(n.related.messageId) : null;
  const actions = [];
  if (ctx) {
    actions.push(
      `<button type="button" class="btn btn--ghost" data-action="story-open-wa" data-owner="${esc(n.characterId)}" data-message="${esc(n.related.messageId)}">${icon('comment', 16)} Open in WhatsApp</button>`
    );
  }
  if (n.storyId) {
    actions.push(
      `<button type="button" class="btn btn--solid" data-action="open-story-chapter" data-story="${esc(n.storyId)}" data-chapter="${esc(n.chapterId || '')}">${icon('book-open', 16)} Read the full story</button>`
    );
  }
  openModal({
    className: 'modal--narration',
    label: 'Story behind this moment',
    html: `<div class="narration">
      <p class="eyebrow">${esc(who ? who.name.split(' ')[0] : n.characterId)} · ${esc(formatFullStamp(n.timestamp))}</p>
      <div class="narration__text">${nl2br(n.text || '')}</div>
      ${chatExcerpt(ctx, n.characterId)}
      ${actions.length ? `<div class="photo-detail__actions">${actions.join('')}</div>` : ''}
    </div>`,
  });
}
