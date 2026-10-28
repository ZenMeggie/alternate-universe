// data/store.js — satu-satunya sumber data dari Firestore untuk semua aplikasi ponsel.
// Koleksi: characters, chats, messages, stickers, narrations, notes, photos, places, posts, xdms, follows,
// timeline, settings (stories/chapters/blocks dibaca langsung oleh apps/stories.js).

import { collection, onSnapshot } from './fsdk.js';
import { db } from '../firebase.js';
import { dateKey, esc, truncate } from '../utils.js';

const NAMES = ['characters', 'chats', 'messages', 'stickers', 'narrations', 'notes', 'photos', 'places', 'posts', 'xdms', 'follows', 'timeline', 'settings'];
const raw = Object.fromEntries(NAMES.map((n) => [n, []]));
const loaded = new Set();
const listeners = new Set();
let started = false;
let derivedCache = null;
let emitTimer = null;
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));
export let storeError = '';

function emit() {
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => {
    derivedCache = null;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }, 30);
}

export function startStore() {
  if (started) return ready;
  started = true;
  for (const name of NAMES) {
    onSnapshot(
      collection(db, name),
      (snap) => {
        raw[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        loaded.add(name);
        if (loaded.size === NAMES.length) readyResolve();
        emit();
      },
      (err) => {
        console.error(`[store] gagal membaca "${name}"`, err);
        storeError = 'Data gagal dimuat. Periksa koneksi Firebase dan Firestore Rules.';
        loaded.add(name);
        if (loaded.size === NAMES.length) readyResolve();
        emit();
      }
    );
  }
  return ready;
}

export const isStoreReady = () => loaded.size === NAMES.length;
export const getCollection = (name) => raw[name] || [];

export function onStoreChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- helpers ---------- */

const time = (ts) => Date.parse(ts) || 0;
const byTime = (a, b) => time(a.timestamp) - time(b.timestamp);
const slug = (v = '') => String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nonEmpty = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)));

/** Cakupan hari: 'day' = tepat di hari cerita, 'upto' = sampai hari cerita. */
export function inScope(ts, state, mode = state.scope) {
  const cur = state.activeStoryDate;
  if (!cur || !ts) return true;
  const d = dateKey(ts);
  return mode === 'day' ? d === cur : d <= cur;
}

/** Waktu acuan (ms) = akhir hari cerita yang aktif; kalau tidak ada, sekarang. */
export function asOfMs(state) {
  const d = state?.activeStoryDate;
  if (!d) return Date.now();
  const t = Date.parse(`${d}T23:59:59+07:00`);
  return Number.isNaN(t) ? Date.now() : t;
}

/* ---------- metadata and timeline from Firestore ---------- */

/** settings/story → { title, subtitle, ... }. Field kosong memakai fallback. */
export function getStoryMeta(fallback = {}) {
  const doc = raw.settings.find((d) => d.id === 'story');
  const { id, ...rest } = nonEmpty(doc || {});
  return { ...fallback, ...rest };
}

/** Timeline is authored by published/coming-soon story parts, not inferred from phone content dates. */
export function getTimeline(fallback = []) {
  const explicit = raw.timeline
    .filter((d) => d.date)
    .map((d) => ({ ...d, events: Array.isArray(d.events) ? d.events : [] }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return explicit.length ? explicit : fallback;
}

export const getDay = (date) => getTimeline().find((day) => day.date === date) || null;
export const getEvent = (id) => {
  for (const day of getTimeline()) {
    const event = (day.events || []).find((item) => item.id === id);
    if (event) return { ...event, date: day.date };
  }
  return null;
};

/* ---------- avatar ---------- */

export function avatarHtml(c, size = 40, cls = '') {
  const src = c?.avatar || c?.photoUrl || c?.image || '';
  const name = c?.name || '?';
  const box = `width:${size}px;height:${size}px;border-radius:50%;flex:0 0 ${size}px`;
  if (src) return `<img class="avatar ${esc(cls)}" src="${esc(src)}" alt="" width="${size}" height="${size}" style="${box};object-fit:cover" loading="lazy" decoding="async">`;
  return `<span class="avatar avatar--fallback ${esc(cls)}" style="${box};display:inline-grid;place-items:center;background:${esc(c?.accent || '#7a8c80')};color:#fff;font-weight:700;font-size:${Math.round(size * 0.42)}px" aria-hidden="true">${esc(name.trim().charAt(0).toUpperCase())}</span>`;
}

/* ---------- characters ---------- */

function normChar(fs) {
  const m = nonEmpty(fs);
  const photo = m.photoUrl || m.avatar || m.image || m.photo || '';
  return {
    ...m,
    name: m.name || m.id,
    username: String(m.username || '').replace(/^@/, ''),
    avatar: photo,
    image: photo,
    photo,
    wallpaper: m.wallpaperUrl || m.wallpaper || '',
    accent: m.accent || '#128c7e',
    phone: m.phone || '',
    location: m.location || '',
    about: m.about || '',
    bio: m.bio || '',
    tagline: m.tagline || '',
    isGroup: false,
  };
}

function derived() {
  if (derivedCache) return derivedCache;
  derivedCache = {
    chars: new Map(raw.characters.map((c) => [c.id, normChar(c)])),
    stickers: new Map(raw.stickers.map((s) => [s.id, s])),
    posts: new Map(raw.posts.map((p) => [p.id, p])),
    messages: new Map(raw.messages.map((m) => [m.id, m])),
    narrations: new Map(raw.narrations.map((n) => [n.id, n])),
    follows: buildFollows(),
  };
  return derivedCache;
}

export const getCharacter = (id) => derived().chars.get(id) || null;
export const getCharacters = () => [...derived().chars.values()];
export const getPlayable = () =>
  getCharacters()
    .filter((c) => c.playable === true)
    .sort((a, b) => a.name.localeCompare(b.name));

/* ---------- follow (X), berlaku menurut waktu cerita ---------- */
// Koleksi "follows": satu dokumen = satu hubungan follow antar akun, dengan since (mulai) dan until (berhenti, opsional).

const acctKey = (charId, accountId) => `${charId}|${accountId}`;

/** Map<kunci akun yang follow, [{ target, since, until }]> dengan waktu dalam milidetik. */
function buildFollows() {
  const byFollower = new Map();
  for (const f of raw.follows) {
    if (!f.followerCharacterId || !f.followerAccountId || !f.targetCharacterId || !f.targetAccountId) continue;
    const since = Date.parse(f.since);
    if (Number.isNaN(since)) continue;
    const until = f.until ? Date.parse(f.until) : Infinity;
    const key = acctKey(f.followerCharacterId, f.followerAccountId);
    if (!byFollower.has(key)) byFollower.set(key, []);
    byFollower.get(key).push({ target: acctKey(f.targetCharacterId, f.targetAccountId), since, until: Number.isNaN(until) ? Infinity : until });
  }
  return byFollower;
}

/** Akun ini sudah punya data follow? Kalau belum, pemanggil memakai aturan lama. */
export const hasFollowData = (charId, accountId) => derived().follows.has(acctKey(charId, accountId));

/** Apakah akun follower mengikuti akun target pada waktu `when` (string waktu atau milidetik)? */
export function isFollowingAt(followerChar, followerAcct, targetChar, targetAcct, when) {
  const list = derived().follows.get(acctKey(followerChar, followerAcct));
  const t = typeof when === 'number' ? when : Date.parse(when);
  if (!list || Number.isNaN(t)) return false;
  const target = acctKey(targetChar, targetAcct);
  return list.some((f) => f.target === target && t >= f.since && t < f.until);
}

/**
 * Followers/following yang ditampilkan di profil = angka dasar akun (fans di luar cast)
 * + jumlah hubungan di koleksi "follows" yang aktif pada akhir hari cerita.
 * Sama dengan perhitungan di editor (displayCounts).
 */
export function followCounts(charId, accountId, state) {
  const acct = getAccount(charId, accountId);
  const id = acct?.id || accountId;
  const me = acctKey(charId, id);
  const t = asOfMs(state);
  let followers = 0;
  let following = 0;
  for (const f of raw.follows) {
    const since = Date.parse(f.since);
    if (Number.isNaN(since) || since > t) continue;
    const until = f.until ? Date.parse(f.until) : Infinity;
    if (!Number.isNaN(until) && t >= until) continue;
    if (acctKey(f.targetCharacterId, f.targetAccountId) === me) followers++;
    if (acctKey(f.followerCharacterId, f.followerAccountId) === me) following++;
  }
  return {
    followers: (Number(acct?.followers) || 0) + followers,
    following: (Number(acct?.following) || 0) + following,
  };
}

/* ---------- twitter accounts ---------- */

export function accountsOf(charId) {
  const c = getCharacter(charId);
  if (!c) return [];
  const list = (c.twitterAccounts || [])
    .filter((a) => a && a.handle)
    .map((a, i) => ({
      ...a,
      id: a.id || slug(a.handle) || `acct${i}`,
      handle: String(a.handle).replace(/^@/, ''),
      displayName: a.displayName || c.name,
      avatarUrl: a.avatarUrl || c.avatar || '',
      bio: a.bio ?? c.bio ?? '',
      private: !!a.private,
      ownerId: c.id,
    }));
  if (!list.length && c.username) {
    const t = c.twitter || {};
    list.push({
      id: 'main',
      handle: c.username,
      displayName: c.name,
      avatarUrl: c.avatar || '',
      bio: c.bio || '',
      private: false,
      ownerId: c.id,
      followers: t.followers || 0,
      following: t.following || 0,
      joined: t.joined || '',
      bannerFrom: t.banner?.[0] || c.accent,
      bannerTo: t.banner?.[1] || c.accent,
    });
  }
  return list;
}

export function getAccount(charId, accountId) {
  const list = accountsOf(charId);
  return list.find((a) => a.id === accountId) || list[0] || null;
}

/* ---------- posts (X) ---------- */

export const getPost = (id) => derived().posts.get(id) || null;

export function postsOfAccount(state, charId, accountId) {
  const first = accountsOf(charId)[0]?.id;
  return raw.posts
    .filter((p) => p.characterId === charId && (p.accountId || first) === accountId && inScope(p.timestamp, state))
    .sort((a, b) => time(b.timestamp) - time(a.timestamp));
}

export function repliesTo(postId, state) {
  return raw.posts.filter((p) => p.kind === 'reply' && p.replyToId === postId && inScope(p.timestamp, state, 'upto')).sort(byTime);
}

export function repostCount(post, state) {
  const n = raw.posts.filter((p) => (p.kind === 'retweet' || p.kind === 'quote') && p.refPostId === post.id && inScope(p.timestamp, state, 'upto')).length;
  return (post.reposts || 0) + n;
}

export function canViewPost(post, viewerId) {
  const a = getAccount(post.characterId, post.accountId);
  return !a?.private || post.characterId === viewerId;
}

export function postImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (p.media?.image) return [p.media.image];
  return [];
}

/* ---------- DM X ---------- */

/**
 * Percakapan DM untuk satu akun X, dikelompokkan per pasangan akun.
 * Hanya pesan yang melibatkan akun ini (sebagai pengirim atau penerima), sampai hari cerita aktif.
 * Hasil: [{ key, other: { charId, acct }, messages: [{..., mine}], last }] urut pesan terbaru.
 */
export function dmThreadsFor(state, charId, accountId) {
  const meAcct = getAccount(charId, accountId);
  if (!meAcct) return [];
  const mk = acctKey(charId, meAcct.id);
  const map = new Map();
  for (const m of raw.xdms) {
    if (!inScope(m.timestamp, state, 'upto')) continue;
    const s = getAccount(m.senderCharacterId, m.senderAccountId);
    const r = getAccount(m.receiverCharacterId, m.receiverAccountId);
    if (!s || !r) continue;
    const sk = acctKey(m.senderCharacterId, s.id);
    const rk = acctKey(m.receiverCharacterId, r.id);
    let otherChar;
    let otherAcct;
    let mine;
    if (sk === mk) {
      otherChar = m.receiverCharacterId;
      otherAcct = r;
      mine = true;
    } else if (rk === mk) {
      otherChar = m.senderCharacterId;
      otherAcct = s;
      mine = false;
    } else continue;
    const key = acctKey(otherChar, otherAcct.id);
    if (!map.has(key)) map.set(key, { key, other: { charId: otherChar, acct: otherAcct }, messages: [] });
    map.get(key).messages.push({ ...m, mine });
  }
  const out = [...map.values()];
  for (const t of out) {
    t.messages.sort(byTime);
    t.last = t.messages[t.messages.length - 1];
  }
  return out.sort((a, b) => time(b.last.timestamp) - time(a.last.timestamp));
}

/* ---------- stickers ---------- */

export function getSticker(id) {
  const s = derived().stickers.get(id);
  return s ? { id, label: s.label || 'Sticker', file: s.imageUrl || s.file || '' } : null;
}

/* ---------- WhatsApp ---------- */

function normMsg(m) {
  const type = m.type || (m.stickerId ? 'sticker' : 'text');
  return { ...m, type, text: m.text || '', image: m.image || m.imageUrl || '', senderId: m.senderId, callKind: m.callKind || 'voice' };
}

export function chatsFor(state) {
  const me = state.activeCharacterId;
  const out = [];
  for (const chat of raw.chats) {
    const members = chat.memberIds || [];
    if (!members.includes(me)) continue;
    const messages = raw.messages
      .filter((m) => m.chatId === chat.id && inScope(m.timestamp, state, 'upto'))
      .map(normMsg)
      .sort(byTime);
    if (!messages.length) continue;
    let contact;
    if (chat.isGroup) {
      contact = {
        id: chat.id,
        name: chat.name || 'Group',
        isGroup: true,
        members: members.map(getCharacter).filter(Boolean),
        description: chat.description || '',
        avatar: chat.photoUrl || '',
        accent: '#128c7e',
        bio: '',
      };
    } else {
      const other = getCharacter(members.find((id) => id !== me));
      if (!other) continue;
      contact = { ...other, isGroup: false };
    }
    out.push({ id: chat.id, characterId: me, contact, messages, last: messages[messages.length - 1] });
  }
  return out.sort((a, b) => time(b.last.timestamp) - time(a.last.timestamp));
}

export function getMessageContext(messageId, radius = 3) {
  const msg = derived().messages.get(messageId);
  if (!msg) return null;
  const chat = raw.chats.find((c) => c.id === msg.chatId);
  const all = raw.messages.filter((m) => m.chatId === msg.chatId).map(normMsg).sort(byTime);
  const i = all.findIndex((m) => m.id === messageId);
  return { chat, focusId: messageId, messages: all.slice(Math.max(0, i - radius), i + radius + 1) };
}

export const getMessage = (id) => {
  const m = derived().messages.get(id);
  return m ? normMsg(m) : null;
};

export const chatName = (chat, viewerId) => {
  if (!chat) return 'Chat';
  if (chat.isGroup && chat.name) return chat.name;
  const other = (chat.memberIds || []).find((id) => id !== viewerId);
  return getCharacter(other)?.name || chat.name || 'Chat';
};

/* ---------- narrations ---------- */

export function getNarration(id) {
  const n = derived().narrations.get(id);
  if (!n) return null;
  return { ...n, related: { messageId: n.messageId || '', eventId: n.eventId || '' } };
}

/* ---------- notes ---------- */

export function notesFor(state) {
  return raw.notes
    .filter((n) => n.characterId === state.activeCharacterId && inScope(n.updatedAt, state))
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

/* ---------- gallery ---------- */

function normPhoto(p) {
  return {
    ...p,
    image: p.image || p.imageUrl || '',
    caption: p.caption || '',
    activity: p.activity || '',
    context: p.context || '',
    locationName: p.locationName || 'Unknown place',
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    people: p.people || [],
    date: dateKey(p.timestamp),
  };
}

export const allPhotosOf = (charId) => raw.photos.filter((p) => p.characterId === charId).map(normPhoto).sort((a, b) => time(b.timestamp) - time(a.timestamp));

export const galleryFor = (state) => allPhotosOf(state.activeCharacterId).filter((p) => inScope(p.timestamp, state));

/* ---------- lookup lintas app (pengganti selectors.js) ---------- */

export function findContent(type, id) {
  if (type === 'note') {
    const item = raw.notes.find((n) => n.id === id);
    return item && { type, id, app: 'notes', characterId: item.characterId, date: dateKey(item.updatedAt), item };
  }
  if (type === 'photo') {
    const p = raw.photos.find((x) => x.id === id);
    if (!p) return null;
    const item = normPhoto(p);
    return { type, id, app: 'gallery', characterId: item.characterId, date: item.date, item };
  }
  if (type === 'tweet') {
    const item = derived().posts.get(id);
    return item && { type, id, app: 'twitter', characterId: item.characterId, date: dateKey(item.timestamp), item };
  }
  if (type === 'message') {
    const m = derived().messages.get(id);
    const chat = m && raw.chats.find((c) => c.id === m.chatId);
    if (!chat) return null;
    const playable = new Set(getPlayable().map((c) => c.id));
    const owner = playable.has(m.senderId) ? m.senderId : (chat.memberIds || []).find((x) => playable.has(x));
    return { type, id, app: 'whatsapp', characterId: owner, date: dateKey(m.timestamp), item: normMsg(m), chat };
  }
  return null;
}

const TYPE_LABEL = { note: 'Note', message: 'Message', photo: 'Photo', tweet: 'Post' };

export function describeContent(found) {
  const { type, item, chat } = found;
  let text = '';
  if (type === 'note') text = item.title;
  if (type === 'photo') text = item.caption || item.locationName;
  if (type === 'tweet') text = truncate(item.text || '', 34);
  if (type === 'message') {
    const who = chat.isGroup
      ? chat.name
      : String(getCharacter((chat.memberIds || []).find((x) => x !== found.characterId))?.name || 'Chat').split(' ')[0];
        text = `${who}: ${item.text ? truncate(item.text, 26) : item.type === 'image' ? 'Photo' : 'Sticker'}`;
  }
  return { label: `${TYPE_LABEL[type]} · ${text}`, short: TYPE_LABEL[type] };
}

/** Semua konten karakter ini yang terkait satu event cerita, lintas empat app. */
export function eventLinks(eventId, characterId, exclude = null) {
  if (!eventId) return [];
  const out = [];
  const push = (type, id) => {
    if (exclude && exclude.type === type && exclude.id === id) return;
    const f = findContent(type, id);
    if (f) out.push({ ...f, ...describeContent(f) });
  };
  raw.notes.filter((n) => n.characterId === characterId && n.eventId === eventId).forEach((n) => push('note', n.id));
  const mine = new Set(raw.chats.filter((c) => (c.memberIds || []).includes(characterId)).map((c) => c.id));
  raw.messages.filter((m) => mine.has(m.chatId) && m.eventId === eventId).forEach((m) => push('message', m.id));
  raw.photos.filter((p) => p.characterId === characterId && p.eventId === eventId).forEach((p) => push('photo', p.id));
  raw.posts.filter((p) => p.characterId === characterId && p.eventId === eventId).forEach((p) => push('tweet', p.id));
  return out;
}

/** Jumlah konten tepat di hari terpilih, untuk badge home. */
export function countsFor(state) {
  const day = state.activeStoryDate;
  const id = state.activeCharacterId;
  const mine = new Set(raw.chats.filter((c) => (c.memberIds || []).includes(id)).map((c) => c.id));
  return {
    notes: raw.notes.filter((n) => n.characterId === id && dateKey(n.updatedAt) === day).length,
    whatsapp: raw.messages.filter((m) => mine.has(m.chatId) && dateKey(m.timestamp) === day).length,
    gallery: raw.photos.filter((p) => p.characterId === id && dateKey(p.timestamp) === day).length,
    twitter: raw.posts.filter((p) => p.characterId === id && dateKey(p.timestamp) === day).length,
  };
}