// Notifikasi dibangun dari data admin lewat store.js:
// pesan WhatsApp masuk + postingan X publik karakter lain, pada hari cerita aktif.
import { chatsFor, getCharacter, getCharacters, accountsOf, postsOfAccount } from '../data/store.js';
import { APP_META } from '../icons.js';
import { esc, dateKey } from '../utils.js';

export const timeOf = (ts) => (String(ts || '').match(/T(\d{2}:\d{2})/) || [])[1] || '';
/** Menit sejak 00:00 dari timestamp cerita, atau null. */
export const minOf = (ts) => { const t = timeOf(ts); if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const callText = (m) => {
  const kind = m.callKind === 'video' ? 'video' : 'voice';
  if (m.type === 'missed_call') return `Missed ${kind} call`;
  if (m.type === 'call') return `Incoming ${kind} call`;
  return 'Call';
};

export function buildNotifications(state, upToMin = Infinity) {
  const me = state.activeCharacterId, day = state.activeStoryDate;
  if (!me || !day) return [];
  const out = [];

  for (const chat of chatsFor({ ...state, scope: 'upto' })) {
    for (const m of chat.messages) {
      if (dateKey(m.timestamp) !== day || m.senderId === me) continue;
      const sender = getCharacter(m.senderId);
      const body = m.type === 'sticker' ? 'Sticker' : m.type === 'text' ? m.text : callText(m);
      out.push({
        app: 'whatsapp', ts: m.timestamp,
        title: chat.contact.name,
        body: chat.contact.isGroup ? `${(sender?.name || '').split(' ')[0]}: ${body}` : body,
        callId: m.type === 'call' ? m.id : '',
      });
    }
  }

  const dayState = { ...state, scope: 'day' };
  for (const c of getCharacters()) {
    if (c.id === me) continue;
    for (const a of accountsOf(c.id)) {
      if (a.private) continue;
      for (const p of postsOfAccount(dayState, c.id, a.id)) {
        if (p.kind === 'retweet') continue;
        out.push({ app: 'twitter', ts: p.timestamp, title: `@${a.handle}`, body: p.text || 'Posted a photo' });
      }
    }
  }
  return out
    .filter((n) => { const m = minOf(n.ts); return m != null && m <= upToMin; })
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

export function notifHtml(n, banner = false) {
  const meta = APP_META[n.app];
  const action = n.callId
    ? `data-action="open-call" data-id="${esc(n.callId)}"`
    : `data-action="open-app" data-app="${esc(n.app)}"`;
  return `<button type="button" class="notif ${banner ? 'notif--banner' : ''}" ${action}>
    <span class="notif__icon">${meta?.tile || ''}</span>
    <span class="notif__main">
      <span class="notif__top"><strong>${esc(n.title)}</strong><time>${esc(timeOf(n.ts))}</time></span>
      <span class="notif__body">${esc(n.body)}</span>
    </span>
  </button>`;
}

export const notifCenterHtml = (list) =>
  list.length ? list.map((n) => notifHtml(n)).join('') : '<p class="sheet__empty">No Notifications</p>';

let timers = [];
export function clearBanners(host) {
  timers.forEach(clearTimeout);
  timers = [];
  host.innerHTML = '';
}

/** Maks. 3 banner berurutan di atas layar. */
export function playBanners(host, list) {
  clearBanners(host);
  list.slice(0, 3).forEach((n, i) => {
    timers.push(setTimeout(() => {
      host.innerHTML = notifHtml(n, true);
      timers.push(setTimeout(() => { host.innerHTML = ''; }, 3600));
    }, 900 + i * 4200));
  });
}
