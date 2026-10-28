// Music (gaya Apple Music): Listen Now (playlist Stories), Library (lagu karakter), Search, mini player & Now Playing.
import { getState, subscribe } from '../state.js';
import { registerApp, registerAction } from '../navigation.js';
import { collection, getDocs, orderBy, query, where } from '../data/fsdk.js';
import { db } from '../firebase.js';
import { getCharacter } from '../data/store.js';
import { esc } from '../utils.js';
import { getMusicState, onMusicChange, setMusicPlaylist, toggleMusic } from '../music-player.js';

const MUSIC_RE = /^\[\[music:\s*(https?:\/\/[^\s|\]]+)\s*(?:\|\s*([^\]]*?))?\s*\]\]$/gm;
let root;
let view = 'listen'; // 'listen' | 'library' | 'search'
let searchQuery = '';
let sheetOpen = false;
let storyTracks = null;
let storyLoading = false;
let storyError = '';
let characterLibrary = null;
let characterLoading = false;
let characterError = '';
let visibleTracks = [];
let lastPlay = null; // { tracks, id } dari lagu yang terakhir diputar lewat app ini

/* ---------- data ---------- */

function extractStoryMusic(blocks, story, chapter) {
  return blocks.flatMap((block) => {
    const text = String(block.text || '').replace(/\r\n/g, '\n');
    return [...text.matchAll(MUSIC_RE)].map((match, index) => ({
      id: `${story.id}/${chapter.id}/${block.id || block.order || index}`,
      url: match[1],
      title: (match[2] || '').trim() || 'Story music',
      artist: story.title || 'Stories',
      album: [chapter.part, chapter.title].filter(Boolean).join(' · '),
      cover: story.coverUrl || '',
    }));
  });
}

async function loadStoryTracks() {
  if (storyTracks || storyLoading) return;
  storyLoading = true;
  storyError = '';
  renderAll();
  try {
    const storySnapshot = await getDocs(query(collection(db, 'stories'), where('status', '==', 'published')));
    const stories = storySnapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const tracks = [];
    for (const story of stories) {
      const chaptersSnapshot = await getDocs(query(collection(db, 'stories', story.id, 'chapters'), orderBy('order', 'asc')));
      for (const chapterDoc of chaptersSnapshot.docs) {
        const chapter = { ...chapterDoc.data(), id: chapterDoc.id };
        if (chapter.status === 'draft') continue;
        const blocksSnapshot = await getDocs(query(collection(db, 'stories', story.id, 'chapters', chapter.id, 'blocks'), orderBy('order', 'asc')));
        tracks.push(...extractStoryMusic(blocksSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })), story, chapter));
      }
    }
    storyTracks = tracks;
  } catch (error) {
    console.error('Gagal memuat playlist musik Stories:', error);
    storyError = 'Playlist Stories gagal dimuat. Periksa koneksi dan Firestore Rules.';
  } finally {
    storyLoading = false;
    renderAll();
  }
}

async function loadCharacterLibrary(force = false) {
  if ((characterLibrary && !force) || characterLoading) return;
  characterLoading = true;
  characterError = '';
  renderAll();
  try {
    const snapshot = await getDocs(collection(db, 'music'));
    characterLibrary = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Gagal memuat musik karakter:', error);
    characterError = 'Musik karakter gagal dimuat. Periksa koneksi dan Firestore Rules.';
  } finally {
    characterLoading = false;
    renderAll();
  }
}

function characterTracks() {
  const { activeCharacterId } = getState();
  return (characterLibrary || [])
    .filter((t) => t.characterId === activeCharacterId && t.audioUrl && t.status !== 'draft')
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    .map((t) => ({
      id: t.id,
      url: t.audioUrl,
      title: t.title || 'Untitled',
      artist: t.artist || getCharacter(t.characterId)?.name || '',
      album: 'Music library',
      cover: t.coverUrl || '',
    }));
}

function currentTracks() {
  if (view === 'listen') return storyTracks || [];
  if (view === 'library') return characterTracks();
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [];
  return [...(storyTracks || []), ...characterTracks()].filter((t) =>
    `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)
  );
}

const playlistId = () =>
  view === 'listen' ? 'music:stories' : view === 'library' ? `music:character:${getState().activeCharacterId}` : 'music:search';

const findTrack = (url) =>
  [...visibleTracks, ...(lastPlay?.tracks || []), ...(storyTracks || []), ...characterTracks()].find((t) => t.url === url) || null;

/* ---------- ikon ---------- */

const ic = (body, s = 24, fill = 'currentColor') =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill}" aria-hidden="true">${body}</svg>`;
const I = {
  play: (s) => ic('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>', s),
  pause: (s) => ic('<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>', s),
  next: (s) => ic('<path d="M5 6.5v11a.8.8 0 0 0 1.2.7l8-5.5a.8.8 0 0 0 0-1.4l-8-5.5A.8.8 0 0 0 5 6.5z"/><rect x="16" y="5.5" width="3" height="13" rx="1.2"/>', s),
  prev: (s) => ic('<path d="M19 6.5v11a.8.8 0 0 1-1.2.7l-8-5.5a.8.8 0 0 1 0-1.4l8-5.5A.8.8 0 0 1 19 6.5z"/><rect x="5" y="5.5" width="3" height="13" rx="1.2"/>', s),
  shuffle: (s) => ic('<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M4 4l5 5M15 15l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', s, 'none'),
  search: (s) => ic('<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', s, 'none'),
  listen: (s) => ic('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.3v7.4a.6.6 0 0 0 .9.5l6-3.7a.6.6 0 0 0 0-1l-6-3.7a.6.6 0 0 0-.9.5z"/>', s),
  library: (s) => ic('<path d="M9 17.5V6.5l10-2v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>', s),
  note: (s) => ic('<path d="M9 17.5V6.5l10-2v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>', s),
  chevron: (s) => ic('<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', s, 'none'),
};

/* ---------- tampilan ---------- */

const coverHtml = (t, cls = '') =>
  t?.cover
    ? `<span class="am-cover ${cls}"><img src="${esc(t.cover)}" alt="" loading="lazy"></span>`
    : `<span class="am-cover am-cover--ph ${cls}">${I.note(46)}</span>`;

function trackRow(t, i, st) {
  const active = st.url === t.url;
  return `<li class="am-row ${active ? 'is-active' : ''}">
    <button type="button" class="am-row__main" data-action="am-play" data-index="${i}" aria-label="Putar ${esc(t.title)}">
      ${coverHtml(t, 'am-cover--sm')}
      <span class="am-row__txt"><strong>${esc(t.title)}</strong><small>${esc(t.artist || '')}${t.artist && t.album ? ' · ' : ''}${esc(t.album || '')}</small></span>
      ${active && st.playing ? '<span class="am-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
    </button>
  </li>`;
}

function listHtml() {
  const st = getMusicState();
  visibleTracks = currentTracks();
  const loading = view === 'listen' ? storyLoading : view === 'library' ? characterLoading : storyLoading || characterLoading;
  const error = view === 'listen' ? storyError : view === 'library' ? characterError : storyError || characterError;
  if (loading) return '<p class="am-empty">Memuat lagu…</p>';
  if (error) return `<div class="am-empty"><p>${esc(error)}</p><button type="button" class="am-btn am-btn--red" data-action="am-retry">Coba lagi</button></div>`;
  if (view === 'search' && !searchQuery.trim()) return '<p class="am-empty">Cari judul lagu, artis, atau album.</p>';
  if (!visibleTracks.length) {
    const c = getCharacter(getState().activeCharacterId);
    return `<p class="am-empty">${view === 'library' ? `Belum ada lagu untuk ${esc(c?.name || 'karakter ini')}.` : view === 'search' ? 'Tidak ada hasil.' : 'Belum ada lagu di bagian cerita yang dipublikasikan.'}</p>`;
  }
  return `<ol class="am-list">${visibleTracks.map((t, i) => trackRow(t, i, st)).join('')}</ol>`;
}

function renderList() {
  const box = root?.querySelector('.am-list-host');
  if (box) box.innerHTML = listHtml();
}

function playerHtml() {
  const st = getMusicState();
  const t = st.url ? findTrack(st.url) : null;
  const title = st.title || t?.title || '';
  const artist = t?.artist || '';
  const mini = st.url
    ? `<div class="am-mini" data-action="am-open" role="button" tabindex="0" aria-label="Buka Now Playing">
        ${coverHtml(t, 'am-cover--mini')}
        <span class="am-mini__title">${esc(title)}</span>
        <button type="button" class="am-ico" data-action="am-toggle" aria-label="${st.playing ? 'Jeda' : 'Putar'}">${st.playing ? I.pause(26) : I.play(26)}</button>
        <button type="button" class="am-ico" data-action="am-next" aria-label="Berikutnya">${I.next(26)}</button>
      </div>`
    : '';
  const sheet = `<div class="am-sheet ${sheetOpen && st.url ? 'is-open' : ''}" aria-hidden="${!(sheetOpen && st.url)}">
      <button type="button" class="am-sheet__close" data-action="am-close" aria-label="Tutup">${I.chevron(30)}</button>
      <div class="am-sheet__art ${st.playing ? 'is-playing' : ''}">${coverHtml(t, 'am-cover--xl')}</div>
      <div class="am-sheet__meta"><strong>${esc(title || 'Nothing Playing')}</strong><span>${esc(artist)}</span></div>
      ${st.error ? `<p class="am-sheet__err">${esc(st.error)}</p>` : ''}
      <div class="am-sheet__ctl">
        <button type="button" class="am-ico am-ico--xl" data-action="am-prev" aria-label="Sebelumnya">${I.prev(40)}</button>
        <button type="button" class="am-ico am-ico--xxl" data-action="am-toggle" aria-label="${st.playing ? 'Jeda' : 'Putar'}">${st.playing ? I.pause(58) : I.play(58)}</button>
        <button type="button" class="am-ico am-ico--xl" data-action="am-next" aria-label="Berikutnya">${I.next(40)}</button>
      </div>
    </div>`;
  return mini + sheet;
}

function renderPlayer() {
  const box = root?.querySelector('.am-player-host');
  if (box) box.innerHTML = playerHtml();
}

const navBtn = (v, label, icon) =>
  `<button type="button" class="am-tab ${view === v ? 'is-on' : ''}" data-action="am-view" data-view="${v}" aria-current="${view === v ? 'page' : 'false'}">${icon(24)}<span>${label}</span></button>`;

function renderAll() {
  if (!root) return;
  const character = getCharacter(getState().activeCharacterId);
  const title = view === 'listen' ? 'Listen Now' : view === 'library' ? 'Library' : 'Search';
  const sub = view === 'listen' ? 'Stories playlist' : view === 'library' ? `${character?.name || 'Character'} songs` : '';
  const showActions = view !== 'search';
  const keepScroll = root.querySelector('.am-scroll')?.scrollTop || 0;

  root.innerHTML = `<div class="am">
    <div class="am-scroll">
      <header class="am-head"><h1>${esc(title)}</h1></header>
      ${view === 'search' ? `<label class="am-search">${I.search(18)}<input type="search" data-am-search placeholder="Artis, lagu, album" value="${esc(searchQuery)}" autocomplete="off"></label>` : ''}
      ${sub ? `<div class="am-section"><h2>${esc(sub)}</h2><span>${currentTracks().length} lagu</span></div>` : ''}
      ${showActions ? `<div class="am-actions">
        <button type="button" class="am-btn" data-action="am-playall">${I.play(18)} Play</button>
        <button type="button" class="am-btn" data-action="am-shuffle">${I.shuffle(18)} Shuffle</button>
      </div>` : ''}
      <div class="am-list-host">${listHtml()}</div>
    </div>
    <div class="am-player-host">${playerHtml()}</div>
    <nav class="am-tabs" aria-label="Music">
      ${navBtn('listen', 'Listen Now', I.listen)}${navBtn('library', 'Library', I.library)}${navBtn('search', 'Search', I.search)}
    </nav>
  </div>`;
  const sc = root.querySelector('.am-scroll');
  if (sc) sc.scrollTop = keepScroll;
}

/* ---------- kontrol ---------- */

function startPlaylist(tracks, startUrl) {
  if (!tracks.length) return;
  lastPlay = { tracks, id: playlistId() };
  setMusicPlaylist(tracks, { id: lastPlay.id, startUrl, autoplay: true });
}

function step(dir) {
  const list = lastPlay?.tracks?.length ? lastPlay.tracks : visibleTracks;
  if (!list.length) return;
  const st = getMusicState();
  const i = list.findIndex((t) => t.url === st.url);
  const next = list[(i + dir + list.length) % list.length];
  setMusicPlaylist(list, { id: lastPlay?.id || playlistId(), startUrl: next.url, autoplay: true });
}

function ensureLoaded() {
  if ((view === 'listen' || view === 'search') && !storyTracks && !storyLoading) loadStoryTracks();
  if ((view === 'library' || view === 'search') && !characterLibrary && !characterLoading) loadCharacterLibrary();
}

/* ---------- style ---------- */

function injectStyle() {
  if (document.getElementById('am-style')) return;
  const s = document.createElement('style');
  s.id = 'am-style';
  s.textContent = `
.am{--red:#fa243c;position:relative;display:flex;flex-direction:column;height:100%;background:#fff;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;overflow:hidden}
.am-scroll{flex:1;overflow-y:auto;padding:calc(var(--sb-h,47px) + 10px) 0 130px;-webkit-overflow-scrolling:touch}
.am-head{padding:6px 20px 8px}
.am-head h1{margin:0;font-size:34px;font-weight:800;letter-spacing:-.6px}
.am-section{display:flex;align-items:baseline;justify-content:space-between;padding:6px 20px 10px;border-bottom:1px solid #ececef}
.am-section h2{margin:0;font-size:20px;font-weight:700}
.am-section span{color:#8e8e93;font-size:13px}
.am-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 20px 8px}
.am-btn{display:flex;align-items:center;justify-content:center;gap:7px;height:44px;border:0;border-radius:11px;background:#f0f0f3;color:var(--red,#fa243c);font:600 16px/1 inherit;cursor:pointer}
.am-btn:active{opacity:.6}
.am-btn--red{background:#fa243c;color:#fff;padding:0 18px;margin-top:8px}
.am-search{display:flex;align-items:center;gap:8px;margin:4px 20px 8px;padding:0 12px;height:38px;border-radius:11px;background:#eeeef1;color:#8e8e93}
.am-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:400 16px/1 inherit;color:#1c1c1e}
.am-list{list-style:none;margin:0;padding:0 0 0 20px}
.am-row{border-bottom:1px solid #ececef}
.am-row__main{display:flex;align-items:center;gap:12px;width:100%;padding:8px 20px 8px 0;border:0;background:none;text-align:left;color:inherit;font:inherit;cursor:pointer}
.am-row__txt{display:grid;gap:2px;min-width:0;flex:1}
.am-row__txt strong{font-size:16px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-row__txt small{color:#8e8e93;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-row.is-active strong{color:var(--red,#fa243c)}
.am-cover{display:block;flex:none;overflow:hidden;background:#e5e5ea}
.am-cover img{display:block;width:100%;height:100%;object-fit:cover}
.am-cover--ph{display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#ff6a7a,#fa243c 60%,#b50f26)}
.am-cover--sm{width:48px;height:48px;border-radius:6px}
.am-cover--mini{width:42px;height:42px;border-radius:7px}
.am-cover--mini svg{width:20px;height:20px}
.am-cover--xl{width:100%;aspect-ratio:1/1;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.28)}
.am-cover--sm svg{width:22px;height:22px}
.am-empty{padding:34px 24px;text-align:center;color:#8e8e93;font-size:15px}
.am-eq{display:flex;align-items:flex-end;gap:2px;height:14px;margin-right:4px}
.am-eq i{width:3px;background:var(--red,#fa243c);border-radius:2px;animation:am-eq 1s ease-in-out infinite}
.am-eq i:nth-child(1){height:40%}.am-eq i:nth-child(2){height:100%;animation-delay:.2s}.am-eq i:nth-child(3){height:60%;animation-delay:.4s}
@keyframes am-eq{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
.am-mini{position:absolute;left:8px;right:8px;bottom:calc(var(--home-h,34px) + 58px);display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:14px;background:rgba(246,246,248,.94);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 6px 22px rgba(0,0,0,.18);cursor:pointer;z-index:3}
.am-mini__title{flex:1;min-width:0;font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-ico{display:grid;place-items:center;border:0;background:none;color:#1c1c1e;padding:4px;cursor:pointer}
.am-ico:active{opacity:.5}
.am-tabs{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-around;padding:8px 0 calc(var(--home-h,34px) + 2px);background:rgba(249,249,251,.94);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-top:1px solid #dcdce0;z-index:4}
.am-tab{display:grid;justify-items:center;gap:3px;border:0;background:none;color:#8e8e93;font:500 10px/1 inherit;cursor:pointer;min-width:70px}
.am-tab.is-on{color:var(--red,#fa243c)}
.am-sheet{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;padding:calc(var(--sb-h,47px) + 8px) 28px 40px;background:linear-gradient(180deg,#f7f7f9 0%,#e6e6eb 100%);transform:translateY(102%);transition:transform .38s cubic-bezier(.2,.8,.2,1);visibility:hidden}
.am-sheet.is-open{transform:translateY(0);visibility:visible}
.am-sheet__close{border:0;background:none;color:#8e8e93;cursor:pointer;margin-bottom:8px}
.am-sheet__art{width:100%;margin-top:14px;transition:transform .4s ease}
.am-sheet__art:not(.is-playing){transform:scale(.86)}
.am-sheet__meta{display:grid;gap:4px;width:100%;margin-top:30px}
.am-sheet__meta strong{font-size:22px;font-weight:700}
.am-sheet__meta span{font-size:19px;color:var(--red,#fa243c)}
.am-sheet__err{width:100%;margin:8px 0 0;color:#c00;font-size:13px}
.am-sheet__ctl{display:flex;align-items:center;justify-content:center;gap:34px;margin-top:auto;padding-bottom:8px}
`;
  document.head.appendChild(s);
}

/* ---------- init ---------- */

export function initMusic() {
  root = document.getElementById('app-music');
  if (!root) return;
  injectStyle();

  registerAction('am-view', (el) => {
    view = ['listen', 'library', 'search'].includes(el.dataset.view) ? el.dataset.view : 'listen';
    sheetOpen = false;
    ensureLoaded();
    renderAll();
    if (view === 'search') root.querySelector('[data-am-search]')?.focus();
  });
  registerAction('am-play', (el) => {
    const t = visibleTracks[Number(el.dataset.index)];
    if (t) startPlaylist(visibleTracks, t.url);
  });
  registerAction('am-playall', () => startPlaylist(visibleTracks, visibleTracks[0]?.url));
  registerAction('am-shuffle', () => {
    const list = [...visibleTracks].sort(() => Math.random() - 0.5);
    startPlaylist(list, list[0]?.url);
  });
  registerAction('am-toggle', (el, ev) => {
    ev?.stopPropagation?.();
    toggleMusic().catch((e) => console.warn('Music', e));
  });
  registerAction('am-next', (el, ev) => { ev?.stopPropagation?.(); step(1); });
  registerAction('am-prev', (el, ev) => { ev?.stopPropagation?.(); step(-1); });
  registerAction('am-open', () => { sheetOpen = true; renderPlayer(); });
  registerAction('am-close', () => { sheetOpen = false; renderPlayer(); });
  registerAction('am-retry', () => {
    if (view !== 'library') { storyTracks = null; loadStoryTracks(); }
    if (view !== 'listen') { characterLibrary = null; loadCharacterLibrary(true); }
  });

  // Pencarian: perbarui daftar saja agar fokus input tidak hilang.
  root.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-am-search]')) return;
    searchQuery = e.target.value;
    renderList();
  });
  // Mini player bisa dibuka dengan Enter.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('.am-mini')) { sheetOpen = true; renderPlayer(); }
  });

  registerApp('music', { root, render: renderAll });
  subscribe((state, changed) => {
    if (state.activeApp !== 'music') return;
    if (changed.includes('activeCharacterId') && view !== 'listen') renderAll();
    if (changed.includes('activeApp')) {
      if (view === 'library') loadCharacterLibrary(true);
      ensureLoaded();
      renderAll();
    }
  });
  onMusicChange(() => { renderList(); renderPlayer(); });
  ensureLoaded();
  renderAll();
}