// X (gaya iOS, mode gelap): banyak akun per karakter, akun private, tweet / repost / quote / reply,
// foto, DM, dan drawer ganti akun. Semua data dari Firestore (posts + xdms + follows + karakter.twitterAccounts).
// Tampilan: Profile (bawaan), Home/Branda (timeline gabungan), Search (akun + postingan), dan DM (chat X).
// Like hanya UI pembaca.

import { getState, subscribe, consumeFocus, setCharacter } from '../state.js';
import { registerApp } from '../navigation.js';
import {
  startStore, onStoreChange, isStoreReady, storeError, getCharacter, getCharacters, getPlayable, avatarHtml, getTimeline,
  accountsOf, getAccount, getPost, postsOfAccount, repliesTo, repostCount, canViewPost, postImages, eventLinks,
  getCollection, inScope, hasFollowData, isFollowingAt, followCounts, dmThreadsFor, asOfMs,
} from '../data/store.js';
import { icon } from '../icons.js';
import { esc, formatStamp, linkMentions, plural, truncate } from '../utils.js';
import { emptyState, linkChips } from '../ui.js';

let root;
const liked = new Set(); // like pembaca (UI saja, bukan data cerita)
const expanded = new Set();
const activeAccountOf = {}; // characterId -> accountId
let highlightPostId = null;
let drawerOpen = false;
let fresh = false; // true setelah ganti akun/tampilan: scroll ke atas + fade-in
let view = 'profile'; // 'profile' | 'home' | 'search' | 'dm'
let searchQuery = '';
let viewing = null; // { charId, accountId }: profil akun lain yang dibuka dari Search
let returnScroll = 0; // posisi scroll hasil Search, dipulihkan saat kembali
let dmThread = null; // kunci percakapan DM yang sedang dibuka ("charId|accountId" lawan bicara)
let dmListScroll = 0;

/** Akun dengan homeMode "random" tampil di Home sebagian saja (stabil per karakter + postingan). */
const RANDOM_SHOW_RATE = 0.5;
const HOME_LIMIT = 150;
const SEARCH_LIMIT = 50;

const first = (s) => String(s || '').split(' ')[0];
const ts = (p) => Date.parse(p.timestamp) || 0;

const safeLinks = (...args) => {
  try {
    return eventLinks(...args) || [];
  } catch {
    return [];
  }
};

/** Event cerita dicari dari timeline Firestore (event harus punya field id). */
function getEvent(id) {
  if (!id) return null;
  for (const day of getTimeline()) {
    const e = (day.events || []).find((x) => x.id === id);
    if (e) return e;
  }
  return null;
}

/* ---------- ikon ---------- */

const svg = (body, size = 24, sw = 1.8) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const X = {
  logo: (s = 26) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  home: (s = 26) => svg('<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>', s, 2),
  search: (s = 26) => svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', s, 2),
  bell: (s = 26) => svg('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>', s, 2),
  mail: (s = 26) => svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>', s, 2),
  feather: (s = 26) => svg('<path d="M12 5v14M5 12h14"/>', s, 2.4),
  check: (s = 20) => svg('<path d="M5 12.5l4.5 4.5L19 7"/>', s, 2.6),
  back: (s = 22) => svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', s, 2.2),
};

const lockIcon = (a) => (a?.private ? `<span class="xi-lock" title="Protected account" aria-label="Protected account">${icon('lock', 13)}</span>` : '');

/* ---------- akun ---------- */

function currentAccount(me) {
  const list = accountsOf(me.id);
  return list.find((a) => a.id === activeAccountOf[me.id]) || list[0] || null;
}

const ownerOf = (c, a) => ({ ...(c || {}), avatar: a?.avatarUrl || c?.avatar, name: a?.displayName || c?.name || '?' });

/* ---------- drawer ganti akun ---------- */

function accountRow(c, a, on) {
  const owner = ownerOf(c, a);
  return `<li><button type="button" class="xi-acct ${on ? 'is-on' : ''}" data-action="x-switch" data-char="${esc(c.id)}" data-id="${esc(a?.id || '')}" aria-pressed="${on}">
    ${avatarHtml(owner, 44)}
    <span class="xi-acct__txt">
      <strong>${esc(owner.name)} ${lockIcon(a)}</strong>
      <small>${a ? `@${esc(a.handle)}` : 'No X account'} · ${esc(first(c.name))}</small>
    </span>
    ${on ? `<span class="xi-acct__check">${X.check()}</span>` : ''}
  </button></li>`;
}

function drawerHtml(state, me, acct) {
  const rows = getPlayable()
    .flatMap((c) => {
      const list = accountsOf(c.id);
      if (!list.length) return [accountRow(c, null, c.id === me.id)];
      return list.map((a) => accountRow(c, a, c.id === me.id && !!acct && a.id === acct.id));
    })
    .join('');
  const owner = ownerOf(me, acct);
  const counts = acct ? followCounts(me.id, acct.id, state) : null;
  return `<div class="xi-scrim" data-action="x-drawer"></div>
    <aside class="xi-drawer" aria-label="Accounts" aria-hidden="${!drawerOpen}">
      <div class="xi-drawer__me">
        ${avatarHtml(owner, 56)}
        <h2>${esc(owner.name)} ${lockIcon(acct)}</h2>
        <p>${acct ? `@${esc(acct.handle)}` : `@${esc(me.username || '')}`}</p>
        ${counts ? `<p class="xi-drawer__counts"><strong>${counts.following}</strong> Following <strong>${counts.followers}</strong> Followers</p>` : ''}
        <div class="xi-drawer__nav"><button type="button" class="${view === 'profile' ? 'is-on' : ''}" data-action="x-view" data-view="profile">Profile</button></div>
      </div>
      <p class="xi-drawer__label">Accounts</p>
      <ul class="xi-accts">${rows}</ul>
      <p class="xi-drawer__foot">Reading as ${esc(first(me.name))}</p>
    </aside>`;
}

/* ---------- profil & post ---------- */

function profileHeader(state, me, a, pill) {
  const from = a.bannerFrom || me.accent || '#316342';
  const to = a.bannerTo || from;
  const owner = ownerOf(me, a);
  const counts = followCounts(me.id, a.id, state);
  return `<section class="xi-profile">
    <div class="xi-banner" style="background:linear-gradient(120deg,${esc(from)},${esc(to)})"></div>
    <div class="xi-profile__row">${avatarHtml(owner, 80, 'xi-ring')}<span class="xi-pill">${esc(pill || (a.private ? 'Protected' : 'Following'))}</span></div>
    <h2>${esc(a.displayName)} ${lockIcon(a)}</h2>
    <p class="xi-handle">@${esc(a.handle)}</p>
    ${a.bio ? `<p class="xi-bio">${esc(a.bio)}</p>` : ''}
    <p class="xi-meta">${me.location ? `${icon('pin', 14)} ${esc(me.location)} &nbsp;` : ''}${a.joined ? `${icon('calendar', 14)} Joined ${esc(a.joined)}` : ''}</p>
    <p class="xi-counts"><strong>${counts.following}</strong> Following <strong>${counts.followers}</strong> Followers</p>
  </section>`;
}

function mediaHtml(p) {
  const imgs = postImages(p).slice(0, 4);
  if (!imgs.length) return '';
  return `<div class="xi-media xi-media--${imgs.length}">${imgs
    .map((src) => `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`)
    .join('')}</div>`;
}

function authorOf(p) {
  const c = getCharacter(p.characterId);
  const a = getAccount(p.characterId, p.accountId);
  return { c, a, owner: ownerOf(c, a) };
}

function headHtml(p) {
  const { a, owner } = authorOf(p);
  return `<p class="xi-head"><strong>${esc(owner.name)}</strong>${lockIcon(a)}<span>@${esc(a?.handle || '?')} · ${esc(formatStamp(p.timestamp))}</span></p>`;
}

/** Kartu kutipan / repost untuk postingan lain; menghormati akun private. */
function embedHtml(ref, viewerId) {
  if (!ref) return `<div class="xi-quote xi-quote--gone"><p>This post is unavailable.</p></div>`;
  if (!canViewPost(ref, viewerId)) {
    return `<div class="xi-quote xi-quote--gone">${icon('lock', 14)} <span>This post is from a protected account.</span></div>`;
  }
  const { a, owner } = authorOf(ref);
  return `<div class="xi-quote">
    <p class="xi-quote__head">${avatarHtml(owner, 20)} <strong>${esc(owner.name)}</strong>${lockIcon(a)} <span>@${esc(a?.handle || '?')} · ${esc(formatStamp(ref.timestamp))}</span></p>
    <p>${linkMentions(esc(ref.text || ''))}</p>
    ${mediaHtml(ref)}
  </div>`;
}

function replyThread(parentId, state, viewerId, depth = 0) {
  const replies = repliesTo(parentId, state).filter((r) => canViewPost(r, viewerId));
  if (!replies.length || depth > 3) return '';
  return `<ul class="xi-replies">${replies
    .map((r) => {
      const { owner } = authorOf(r);
      return `<li class="xi-reply">
        ${avatarHtml(owner, 34)}
        <div>${headHtml(r)}
          <p class="xi-text">${linkMentions(esc(r.text || ''))}</p>
          ${mediaHtml(r)}
          ${replyThread(r.id, state, viewerId, depth + 1)}
        </div>
      </li>`;
    })
    .join('')}</ul>`;
}

function post(entry, state) {
  const viewerId = state.activeCharacterId;
  const isRepost = entry.kind === 'retweet';
  const me = getCharacter(entry.characterId);
  const myAcct = getAccount(entry.characterId, entry.accountId);
  const shown = isRepost ? getPost(entry.refPostId) : entry;

  const label = isRepost
    ? `<p class="xi-label">${icon('repost', 14)} ${esc(myAcct?.displayName || me?.name || '')} reposted</p>`
    : entry.kind === 'reply'
      ? (() => {
          const parent = getPost(entry.replyToId);
          const pa = parent ? getAccount(parent.characterId, parent.accountId) : null;
          return pa ? `<p class="xi-label">Replying to <span class="mention">@${esc(pa.handle)}</span></p>` : '';
        })()
      : '';

  if (isRepost && (!shown || !canViewPost(shown, viewerId))) {
    return `<article class="xi-post" id="post-${esc(entry.id)}"><div class="xi-post__main">${label}${embedHtml(shown, viewerId)}</div></article>`;
  }

  const { owner } = authorOf(shown);
  const isLiked = liked.has(shown.id);
  const open = expanded.has(shown.id);
  const replies = repliesTo(shown.id, state).filter((r) => canViewPost(r, viewerId));
  const reposts = repostCount(shown, state);
  const likes = Number(shown.likes) || 0;
  const ev = shown.eventId ? getEvent(shown.eventId) : null;
  const links = ev ? safeLinks(shown.eventId, shown.characterId, { type: 'tweet', id: shown.id }) : [];
  const quote = shown.kind === 'quote' ? embedHtml(getPost(shown.refPostId), viewerId) : '';

  return `<article class="xi-post ${entry.id === highlightPostId ? 'is-highlight' : ''}" id="post-${esc(entry.id)}">
    ${avatarHtml(owner, 42)}
    <div class="xi-post__main">
      ${label}
      ${headHtml(shown)}
      ${shown.text ? `<p class="xi-text">${linkMentions(esc(shown.text))}</p>` : ''}
      ${mediaHtml(shown)}
      ${quote}
      <div class="xi-actions">
        <button type="button" class="xi-act ${open ? 'is-on' : ''}" data-action="toggle-replies" data-id="${esc(shown.id)}" aria-expanded="${open}" aria-label="${plural(replies.length, 'reply', 'replies')}">${icon('comment', 18)}<span>${replies.length}</span></button>
        <span class="xi-act">${icon('repost', 18)}<span>${reposts}</span></span>
        <button type="button" class="xi-act xi-like ${isLiked ? 'is-liked' : ''}" data-action="toggle-like" data-id="${esc(shown.id)}" data-base="${likes}" aria-pressed="${isLiked}" aria-label="Like">${icon('heart', 18, { fill: isLiked })}<span>${likes + (isLiked ? 1 : 0)}</span></button>
        ${shown.narrationId ? `<button type="button" class="xi-act xi-narr" data-action="open-narration" data-id="${esc(shown.narrationId)}" aria-label="Story behind this post" title="Story behind this post">${icon('info', 17)}</button>` : ''}
      </div>
      ${open ? replyThread(shown.id, state, viewerId) : ''}
      ${ev && links.length ? `<div class="xi-related"><p>Behind this post: ${esc(ev.title)}</p>${linkChips(links)}</div>` : ''}
    </div>
  </article>`;
}

/* ---------- Home (Branda) ---------- */

/** Angka stabil 0..1 dari teks (FNV-1a): hasil "acak" yang sama setiap kali dibuka. */
function stableUnit(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Pil di profil akun lain menurut data follow pada hari cerita yang aktif (sampai akhir hari itu).
 * Mengembalikan undefined bila akun yang dibaca belum punya data follow, sehingga teks lama dipakai.
 */
function followPill(state, me, acct, c, a) {
  if (c.id === me.id || !acct || !hasFollowData(me.id, acct.id)) return undefined;
  const asOf = asOfMs(state);
  if (isFollowingAt(me.id, acct.id, c.id, a.id, asOf)) return 'Following';
  return a.private ? 'Protected' : 'Follow';
}

/**
 * Isi Home: postingan akun yang sedang dibaca + postingan akun lain.
 * Aturan akun lain: bukan reply, dalam cakupan hari, lolos aturan private. Jika akun yang dibaca punya data
 * follow (koleksi "follows"), akun penulis harus sudah diikuti pada waktu postingan itu dibuat. Lalu homeMode:
 * "hide" tidak pernah muncul, "random" muncul sebagian (stabil), selain itu ("show"/kosong) muncul.
 * Akun lain milik karakter yang sama (akun alt) tidak ikut, supaya tidak membocorkan identitas.
 */
function homeEntries(state, me, acct) {
  const mine = acct ? postsOfAccount(state, me.id, acct.id).filter((p) => p.kind !== 'reply') : [];
  const useFollows = !!acct && hasFollowData(me.id, acct.id);
  const others = getCollection('posts').filter((p) => {
    if (p.characterId === me.id || p.kind === 'reply') return false;
    if (!inScope(p.timestamp, state)) return false;
    if (!canViewPost(p, me.id)) return false;
    const author = getAccount(p.characterId, p.accountId);
    if (useFollows && !isFollowingAt(me.id, acct.id, p.characterId, author?.id, p.timestamp)) return false;
    const mode = author?.homeMode;
    if (mode === 'hide') return false;
    if (mode === 'random') return stableUnit(`${p.id}|${me.id}`) < RANDOM_SHOW_RATE;
    return true;
  });
  return [...mine, ...others].sort((a, b) => ts(b) - ts(a)).slice(0, HOME_LIMIT);
}

/* ---------- Search ---------- */

function searchResultsHtml(state, me) {
  if (!isStoreReady()) return emptyState({ iconName: 'comment', title: 'Loading…', text: 'Fetching posts.' });
  const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
  if (!q) return emptyState({ iconName: 'comment', title: 'Search', text: 'Find accounts and posts.' });

  // Akun dicari dari handle dan nama tampilan saja (bukan nama karakter), agar akun alt tidak terbuka identitasnya.
  const people = getCharacters()
    .flatMap((c) => accountsOf(c.id).map((a) => ({ c, a })))
    .filter(({ a }) => `${a.handle} ${a.displayName}`.toLowerCase().includes(q));

  const posts = getCollection('posts')
    .filter((p) => p.kind !== 'retweet' && inScope(p.timestamp, state) && canViewPost(p, me.id))
    .filter((p) => {
      const a = getAccount(p.characterId, p.accountId);
      return `${p.text || ''} ${a?.handle || ''} ${a?.displayName || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => ts(b) - ts(a))
    .slice(0, SEARCH_LIMIT);

  if (!people.length && !posts.length) return emptyState({ iconName: 'comment', title: 'No results', text: 'Try a different keyword.' });

  const peopleHtml = people.length
    ? `<h3 class="xi-section-title">Accounts</h3><ul class="xi-people">${people
        .map(({ c, a }) => `<li class="xi-person"><button type="button" class="xi-person__btn" data-action="x-open-profile" data-char="${esc(c.id)}" data-id="${esc(a.id)}">${avatarHtml(ownerOf(c, a), 44)}<span><strong>${esc(a.displayName)} ${lockIcon(a)}</strong><small>@${esc(a.handle)}</small>${a.bio ? `<small>${esc(a.bio)}</small>` : ''}</span></button></li>`)
        .join('')}</ul>`
    : '';
  const postsHtml = posts.length ? `<h3 class="xi-section-title">Posts</h3><div class="xi-feed">${posts.map((p) => post(p, state)).join('')}</div>` : '';
  return peopleHtml + postsHtml;
}

function searchViewHtml(state, me) {
  return `<div class="xi-search"><input type="search" data-xsearch value="${esc(searchQuery)}" placeholder="Search accounts and posts" aria-label="Search accounts and posts" autocomplete="off"></div>
    ${scopeTabs(state)}
    <div class="xi-results">${searchResultsHtml(state, me)}</div>`;
}

/* ---------- DM (chat X) ---------- */

function dmPreview(m) {
  const text = m.text ? truncate(m.text, 48) : postImages(m).length ? '[photo]' : '';
  return `${m.mine ? 'You: ' : ''}${text}`;
}

function dmListHtml(state, me, acct) {
  if (!isStoreReady()) return emptyState({ iconName: 'comment', title: 'Loading…', text: 'Fetching messages.' });
  if (!acct) return emptyState({ iconName: 'comment', title: 'No X account', text: 'This character has no X account.' });
  const threads = dmThreadsFor(state, me.id, acct.id);
  if (!threads.length) return emptyState({ iconName: 'comment', title: 'No messages', text: `@${acct.handle} has no messages yet.` });
  return `<h2 class="xi-section-title">Messages</h2><ul class="xi-people">${threads
    .map((t) => {
      const c = getCharacter(t.other.charId);
      const a = t.other.acct;
      return `<li class="xi-person"><button type="button" class="xi-person__btn" data-action="x-open-dm" data-key="${esc(t.key)}">${avatarHtml(ownerOf(c, a), 44)}<span class="xi-dm__txt"><strong>${esc(a.displayName)} ${lockIcon(a)} <em>@${esc(a.handle)} · ${esc(formatStamp(t.last.timestamp))}</em></strong><small>${esc(dmPreview(t.last))}</small></span></button></li>`;
    })
    .join('')}</ul>`;
}

function dmThreadHtml(state, me, acct) {
  const threads = acct ? dmThreadsFor(state, me.id, acct.id) : [];
  const t = threads.find((x) => x.key === dmThread);
  if (!t) {
    dmThread = null;
    return dmListHtml(state, me, acct);
  }
  const otherChar = getCharacter(t.other.charId);
  const other = t.other.acct;
  const myOwner = ownerOf(me, acct);
  const head = `<div class="xi-dm__head">${avatarHtml(ownerOf(otherChar, other), 56)}<strong>${esc(other.displayName)} ${lockIcon(other)}</strong><small>@${esc(other.handle)}</small>${other.bio ? `<small>${esc(other.bio)}</small>` : ''}</div>`;
  const bubbles = t.messages
    .map((m) => {
      const imgs = mediaHtml(m);
      return `<div class="xi-dm__row ${m.mine ? 'is-mine' : ''}">
        ${m.mine ? '' : avatarHtml(ownerOf(otherChar, other), 28)}
        <div class="xi-dm__col">
          <div class="xi-dm__bubble">${m.text ? `<p>${linkMentions(esc(m.text))}</p>` : ''}${imgs}</div>
          <small>${esc(formatStamp(m.timestamp))}${m.narrationId ? ` <button type="button" class="xi-act xi-narr" data-action="open-narration" data-id="${esc(m.narrationId)}" aria-label="Story behind this message" title="Story behind this message">${icon('info', 14)}</button>` : ''}</small>
        </div>
      </div>`;
    })
    .join('');
  return `${head}<div class="xi-dm__thread" aria-label="Conversation with @${esc(other.handle)} as ${esc(myOwner.name)}">${bubbles}</div>`;
}

/* ---------- render ---------- */

const scopeTabs = (state) => `<div class="xi-tabs" role="tablist">
        <button type="button" role="tab" class="xi-tab ${state.scope === 'day' ? 'is-on' : ''}" aria-selected="${state.scope === 'day'}" data-action="set-scope" data-scope="day">This day</button>
        <button type="button" role="tab" class="xi-tab ${state.scope === 'upto' ? 'is-on' : ''}" aria-selected="${state.scope === 'upto'}" data-action="set-scope" data-scope="upto">Up to this day</button>
      </div>`;

const barButton = (v, iconHtml, label) =>
  `<button type="button" class="${view === v ? 'is-on' : ''}" data-action="x-view" data-view="${v}" aria-label="${label}" aria-pressed="${view === v}">${iconHtml}</button>`;

export function renderTwitter() {
  const state = getState();
  const me = getCharacter(state.activeCharacterId);
  if (!me) {
    root.innerHTML = `<div class="xi">${emptyState({ iconName: 'comment', title: isStoreReady() ? 'No character' : 'Loading…', text: storeError || 'Fetching accounts.' })}</div>`;
    return;
  }

  if (state.focus && state.focus.type === 'tweet') {
    const target = getPost(state.focus.id);
    if (target) {
      if (target.characterId === me.id) {
        activeAccountOf[me.id] = getAccount(me.id, target.accountId)?.id;
        view = 'profile'; // post yang disorot ada di profil akunnya
        viewing = null;
        dmThread = null;
      }
      highlightPostId = target.id;
      expanded.add(target.id);
    }
    consumeFocus();
  }

  const acct = currentAccount(me);
  let viewed = null; // profil akun lain yang dibuka dari Search
  if (viewing) {
    const vc = getCharacter(viewing.charId);
    const va = vc ? accountsOf(vc.id).find((x) => x.id === viewing.accountId) : null;
    if (vc && va) viewed = { c: vc, a: va };
    else viewing = null;
  }
  const protectedView = !!viewed && viewed.a.private && viewed.c.id !== me.id;
  const posts = viewed
    ? protectedView ? [] : postsOfAccount(state, viewed.c.id, viewed.a.id)
    : view === 'home' ? homeEntries(state, me, acct) : view === 'search' || view === 'dm' ? [] : acct ? postsOfAccount(state, me.id, acct.id) : [];
  if (!posts.some((p) => p.id === highlightPostId)) highlightPostId = null;
  const scrollY = fresh ? 0 : root.querySelector('.xi-scroll')?.scrollTop || 0;
  const fade = fresh ? ' xi-fade' : '';
  fresh = false;

  const scopeText = state.scope === 'day' ? 'on this day' : 'by this day';
  const feed = !isStoreReady()
    ? emptyState({ iconName: 'comment', title: 'Loading…', text: 'Fetching posts.' })
    : protectedView
      ? emptyState({ iconName: 'comment', title: 'These posts are protected', text: `Only approved followers can see @${viewed.a.handle}'s posts.` })
      : storeError && !posts.length
      ? emptyState({ iconName: 'comment', title: 'Could not load posts', text: storeError })
      : posts.length
        ? `<div class="xi-feed">${posts.map((p) => post(p, state)).join('')}</div>`
        : view === 'home'
          ? emptyState({ iconName: 'comment', title: 'Nothing here yet', text: `No posts to show ${scopeText}.` })
          : emptyState({ iconName: 'comment', title: 'No posts', text: `@${viewed ? viewed.a.handle : acct?.handle || me.username || ''} didn't post ${scopeText}.` });

  let body;
  if (viewed) body = `${profileHeader(state, viewed.c, viewed.a, followPill(state, me, acct, viewed.c, viewed.a))}${protectedView ? '' : scopeTabs(state)}${feed}`;
  else if (view === 'search') body = searchViewHtml(state, me);
  else if (view === 'dm') body = dmThread ? dmThreadHtml(state, me, acct) : dmListHtml(state, me, acct);
  else if (view === 'home') body = `<h2 class="xi-section-title">Home</h2>${scopeTabs(state)}${feed}`;
  else body = `${acct ? profileHeader(state, me, acct) : `<section class="xi-profile xi-profile--empty"><h2>${esc(me.name)}</h2><p class="xi-bio">No X account yet.</p></section>`}${scopeTabs(state)}${feed}`;

  const topAvatar = ownerOf(me, acct);
  const showBack = !!viewed || (view === 'dm' && !!dmThread);

  root.innerHTML = `<div class="xi ${drawerOpen ? 'is-drawer' : ''}">
    <header class="xi-top">
      ${showBack
        ? `<button type="button" class="xi-me" data-action="x-back" aria-label="Back">${X.back()}</button>`
        : `<button type="button" class="xi-me" data-action="x-drawer" aria-label="Switch account" aria-haspopup="true">${avatarHtml(topAvatar, 32)}</button>`}
      <span class="xi-logo">${X.logo(24)}</span>
      <span class="xi-top__space"></span>
    </header>
    <div class="xi-scroll${fade}">
      ${body}
    </div>
    <span class="xi-fab" aria-hidden="true">${X.feather(26)}</span>
    <nav class="xi-bar" aria-label="X navigation">${barButton('home', X.home(), 'Home')}${barButton('search', X.search(), 'Search')}${X.bell()}${barButton('dm', X.mail(), 'Messages')}</nav>
    ${drawerHtml(state, me, acct)}
  </div>`;

  const scroller = root.querySelector('.xi-scroll');
  const target = highlightPostId && root.querySelector(`#post-${CSS.escape(highlightPostId)}`);
  if (target) target.scrollIntoView({ block: 'center' });
  else if (view === 'dm' && dmThread && !fresh && scroller && !scrollY) scroller.scrollTop = scroller.scrollHeight;
  else if (scroller) scroller.scrollTop = scrollY;
}

/* ---------- style tambahan (hanya untuk elemen baru) ---------- */

function injectStyle() {
  if (document.getElementById('xi-extra-style')) return;
  const s = document.createElement('style');
  s.id = 'xi-extra-style';
  s.textContent = `
.xi-bar button{background:none;border:0;color:inherit;padding:6px 10px;display:grid;place-items:center;cursor:pointer;opacity:.6}
.xi-bar button.is-on{opacity:1}
.xi-section-title{margin:12px 16px 4px;font-size:16px;font-weight:700}
.xi-search{position:sticky;top:0;z-index:2;padding:8px 12px;background:inherit}
.xi-search input{width:100%;box-sizing:border-box;padding:10px 14px;border-radius:999px;border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.15);color:inherit;font:inherit}
.xi-people{list-style:none;margin:0;padding:0}
.xi-person__btn{display:flex;gap:10px;align-items:center;width:100%;padding:10px 16px;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.xi-person__btn:hover{background:rgba(128,128,128,.12)}
.xi-person small{display:block;opacity:.65}
.xi-drawer__nav{display:flex;gap:8px;margin-top:10px}
.xi-drawer__nav button{background:rgba(128,128,128,.18);border:0;color:inherit;font:inherit;padding:6px 14px;border-radius:999px;cursor:pointer}
.xi-drawer__nav button.is-on{outline:1px solid currentColor}
.xi-dm__txt{min-width:0;flex:1}
.xi-dm__txt strong{display:block}
.xi-dm__txt em{font-style:normal;font-weight:400;opacity:.6;font-size:.85em}
.xi-dm__txt small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xi-dm__head{display:flex;flex-direction:column;align-items:center;gap:2px;padding:18px 16px 10px;text-align:center}
.xi-dm__head small{opacity:.65}
.xi-dm__thread{display:flex;flex-direction:column;gap:10px;padding:8px 12px 24px}
.xi-dm__row{display:flex;align-items:flex-end;gap:8px;max-width:88%}
.xi-dm__row.is-mine{align-self:flex-end;flex-direction:row-reverse}
.xi-dm__col{display:flex;flex-direction:column;gap:2px;min-width:0}
.xi-dm__row.is-mine .xi-dm__col{align-items:flex-end}
.xi-dm__col small{opacity:.6;font-size:11px;display:flex;align-items:center;gap:4px}
.xi-dm__bubble{padding:9px 13px;border-radius:18px;background:rgba(128,128,128,.22);overflow-wrap:anywhere}
.xi-dm__row.is-mine .xi-dm__bubble{background:#1d9bf0;color:#fff;border-bottom-right-radius:5px}
.xi-dm__row:not(.is-mine) .xi-dm__bubble{border-bottom-left-radius:5px}
.xi-dm__bubble p{margin:0;white-space:pre-wrap}
.xi-dm__bubble .xi-media{margin-top:6px}`;
  document.head.appendChild(s);
}

/* ---------- init ---------- */

export function initTwitter(registerAction) {
  root = document.getElementById('app-twitter');
  injectStyle();

  // Like diperbarui langsung di tombolnya: tanpa render ulang, tanpa kedip, scroll tidak lompat.
  registerAction('toggle-like', (el) => {
    const id = el.dataset.id;
    const on = !liked.has(id);
    if (on) liked.add(id);
    else liked.delete(id);
    el.classList.toggle('is-liked', on);
    el.setAttribute('aria-pressed', String(on));
    el.innerHTML = `${icon('heart', 18, { fill: on })}<span>${(Number(el.dataset.base) || 0) + (on ? 1 : 0)}</span>`;
  });

  registerAction('toggle-replies', (el) => {
    const id = el.dataset.id;
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    highlightPostId = null;
    renderTwitter();
  });

  // Buka/tutup drawer lewat class saja, supaya transisi CSS berjalan mulus.
  registerAction('x-drawer', () => {
    drawerOpen = !drawerOpen;
    const box = root.querySelector('.xi');
    box?.classList.toggle('is-drawer', drawerOpen);
    box?.querySelector('.xi-drawer')?.setAttribute('aria-hidden', String(!drawerOpen));
  });

  // Ganti akun: pilih karakter + akun X-nya sekaligus.
  registerAction('x-switch', (el) => {
    const charId = el.dataset.char;
    if (!charId) return;
    if (el.dataset.id) activeAccountOf[charId] = el.dataset.id;
    drawerOpen = false;
    highlightPostId = null;
    viewing = null;
    dmThread = null;
    fresh = true;
    if (!setCharacter(charId)) renderTwitter(); // karakter sama → render manual
  });

  // Ganti tampilan: profile / home / search / dm.
  registerAction('x-view', (el) => {
    const next = el.dataset.view;
    if (!['profile', 'home', 'search', 'dm'].includes(next)) return;
    view = next;
    viewing = null;
    dmThread = null;
    drawerOpen = false;
    highlightPostId = null;
    fresh = true;
    renderTwitter();
    if (view === 'search') root.querySelector('[data-xsearch]')?.focus();
  });

  // Buka profil akun lain dari hasil Search, dan kembali ke hasil dengan posisi scroll yang sama.
  registerAction('x-open-profile', (el) => {
    if (!el.dataset.char || !el.dataset.id) return;
    returnScroll = root.querySelector('.xi-scroll')?.scrollTop || 0;
    viewing = { charId: el.dataset.char, accountId: el.dataset.id };
    drawerOpen = false;
    highlightPostId = null;
    fresh = true;
    renderTwitter();
  });

  // Buka satu percakapan DM; tombol kembali menutupnya dan memulihkan scroll daftar.
  registerAction('x-open-dm', (el) => {
    if (!el.dataset.key) return;
    dmListScroll = root.querySelector('.xi-scroll')?.scrollTop || 0;
    dmThread = el.dataset.key;
    fresh = false;
    renderTwitter();
    const scroller = root.querySelector('.xi-scroll');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  registerAction('x-back', () => {
    if (!viewing && view === 'dm' && dmThread) {
      dmThread = null;
      renderTwitter();
      const scroller = root.querySelector('.xi-scroll');
      if (scroller) scroller.scrollTop = dmListScroll;
      return;
    }
    viewing = null;
    highlightPostId = null;
    renderTwitter();
    const scroller = root.querySelector('.xi-scroll');
    if (scroller) scroller.scrollTop = returnScroll;
  });

  // Ketik di kolom Search: perbarui hasil saja, tanpa render ulang seluruh app (fokus tidak hilang).
  root.addEventListener('input', (event) => {
    if (!event.target.matches?.('[data-xsearch]')) return;
    searchQuery = event.target.value;
    const state = getState();
    const me = getCharacter(state.activeCharacterId);
    const box = root.querySelector('.xi-results');
    if (box && me) box.innerHTML = searchResultsHtml(state, me);
  });

  registerApp('twitter', { root, render: renderTwitter });
  startStore();
  renderTwitter();
  subscribe(() => renderTwitter());
  onStoreChange(() => renderTwitter());
}