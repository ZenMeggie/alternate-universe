// apps/storyblocks.js — renderer isi bab: paragraf, dialog gaya novel, bubble chat, panggilan, gambar.
// Format blok mengikuti Story CMS (stories/{id}/chapters/{id}/blocks/{id}).

import { esc } from '../utils.js';
import { setState } from '../state.js';
import { openApp } from '../navigation.js';
import { getCharacter, findContent, getMessage, getSticker } from '../data/store.js';
import { richText } from '../richtext.js';

const ALIGNS = new Set(['left', 'center', 'right', 'justify']);

export const chapterAlign = (chapter) => {
  const a = chapter.alignment || chapter.align || chapter.defaultAlignment || chapter.defaultAlign || 'left';
  return ALIGNS.has(a) ? a : 'left';
};

const alignOf = (block, chapter) => {
  const a = block.alignment || block.align;
  return ALIGNS.has(a) ? a : chapterAlign(chapter);
};

const norm = (v) => String(v || '').trim().toLowerCase();

/** Escape dulu, baru ubah penanda: ***tebal miring***, **tebal**, *miring*. */
const fmt = (t) =>
  esc(t || '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

function senderInfo(b) {
  const c = getCharacter(b.characterId);
  return { id: b.characterId, name: c?.name || b.character || b.characterId || '?', first: (c?.name || b.character || '').split(' ')[0] };
}

/** True bila pengirim adalah tokoh POV bab (cocok dengan id, nama, atau nama depan). */
function isPov(b, pov) {
  if (!pov) return false;
  const s = senderInfo(b);
  return [s.id, s.name, s.first].some((x) => norm(x) === norm(pov));
}

/** Deret blok chat berurutan digabung jadi satu kartu percakapan; 1 blok = 1 bubble. */
/** Isi bubble: dari pesan WhatsApp (teks / stiker / panggilan), atau teks manual lama. */
function bubbleBody(m, b, mine) {
  if (!m) return fmt(b.text || b.messages?.[0]?.text || '');
  if (m.type === 'call' || m.type === 'missed_call') {
    const kind = m.callKind === 'video' ? 'video' : 'voice';
    const label = m.type === 'missed_call'
      ? (mine ? `${kind} call · no answer` : `Missed ${kind} call`)
      : `${mine ? 'Outgoing' : 'Incoming'} ${kind} call${m.duration ? ` · ${esc(m.duration)}` : ''}`;
    return `📞 ${label}`;
  }
  if (m.stickerId) {
    const s = getSticker(m.stickerId);
    const img = s
      ? `<img class="sticker" src="${esc(s.file)}" alt="Sticker: ${esc(s.label)}" data-label="${esc(s.label)}" loading="lazy" style="max-width:120px;display:block">`
      : '[Sticker]';
    return img + (m.text ? fmt(m.text) : '');
  }
  return fmt(m.text);
}

/** Deret blok chat berurutan jadi satu kartu percakapan; 1 blok = 1 bubble. */
function chatCard(run, pov) {
  const items = run.map((b) => {
    const m = b.messageId ? getMessage(b.messageId) : null;
    return { b, m, who: { characterId: m?.senderId || b.characterId, character: b.character } };
  });
  const mine = (it) => isPov(it.who, pov);
  const other = items.find((it) => !mine(it)) || items[0];
  const otherName = senderInfo(other.who).name;

  const bubbles = items
    .map((it) => {
      const out = mine(it);
      return `<button type="button" class="sc-chat__group ${out ? 'is-out' : 'is-in'}"
          data-action="story-open-wa" data-owner="${esc(it.who.characterId || '')}" data-message="${esc(it.b.messageId || '')}"
          aria-label="Buka percakapan di WhatsApp"><span class="sc-msg ${out ? 'sc-msg--out' : 'sc-msg--in'}">${bubbleBody(it.m, it.b, out)}</span></button>`;
    })
    .join('');

  return `<div class="sc-chat">
    <div class="sc-chat__head"><span class="sc-chat__dot" aria-hidden="true"></span>WhatsApp · ${esc(otherName)}</div>
    <div class="sc-chat__body">${bubbles}</div>
    <div class="sc-chat__foot">Ketuk pesan untuk membukanya di WhatsApp ↗</div>
  </div>`;
}

function block(b, chapter) {
  const al = `align-${alignOf(b, chapter)}`;
  switch (b.type) {
    case 'heading':
      return `<h2 class="sc-h ${al}">${fmt(b.text)}</h2>`;
    case 'location':
      return `<p class="sc-loc ${al}">${fmt(b.text)}</p>`;
        case 'paragraph':
      return richText(b.text, alignOf(b, chapter), 'sc-p');
    case 'italic':
      return `<p class="sc-p sc-it ${al}">${fmt(b.text)}</p>`;
    case 'dialogue':
      return `<p class="sc-p sc-say ${al}" data-speaker="${esc(b.character)}">“${fmt(b.text)}”</p>`;
    case 'call': {
      const label = b.callText || b.text || `${b.character || 'Someone'} Calling...`;
      return `<div class="sc-call"><span class="sc-call__ico" aria-hidden="true">📞</span><span>${esc(label)}</span></div>`;
    }
    case 'image':
      if (!b.src) return '';
      return `<figure class="sc-fig"><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy" onerror="this.closest('figure').classList.add('is-broken')"><figcaption>${esc(b.alt || '')}</figcaption></figure>`;
    default:
      return '';
  }
}

export function renderStoryBlocks(chapter, blocks) {
  const pov = chapter.pov || '';
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'chat') {
      const run = [b];
      while (blocks[i + 1]?.type === 'chat') run.push(blocks[++i]);
      out.push(chatCard(run, pov));
    } else {
      out.push(block(b, chapter));
    }
  }
  return `<div class="sc">${out.join('')}</div>`;
}

/** Panggil sekali saat init: initStoryLinks(registerAction) */
export function initStoryLinks(registerAction) {
  registerAction('story-open-wa', (el) => {
    const messageId = el.dataset.message;
    const found = messageId ? findContent('message', messageId) : null;
    const ownerId = el.dataset.owner || found?.characterId;
    if (!ownerId) return;

    document.querySelector('.modal-backdrop .modal__close')?.click();
    // WhatsApp hanya menampilkan pesan sampai tanggal aktif, jadi tanggal pesan ikut di-set.
    setState({
      activeCharacterId: ownerId,
      ...(found ? { activeStoryDate: found.date, focus: { type: 'message', id: messageId, nonce: Date.now() } } : {}),
    });
    openApp('whatsapp');
  });
}