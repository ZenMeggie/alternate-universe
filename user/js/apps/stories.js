// Stories app: membaca stories → chapters → blocks dari Firestore (hasil Story CMS).

import { registerApp, openApp } from '../navigation.js';
import { esc } from '../utils.js';
import { renderStoryBlocks, initStoryLinks, chapterAlign } from './storyblocks.js';
import { collection, getDocs, orderBy, query } from '../data/fsdk.js';
import { db } from '../firebase.js';
import { getMusicState, onMusicChange, setMusicPlaylist, seekMusic, setMusicVolume, toggleMusic, toggleMusicMute } from '../music-player.js';

let root;
let stories = []; // [{ id, title, subtitle, description, coverUrl, status, chapters: [...] }]
let currentRef = null; // { storyId, chapterId }
let loading = false;
let loaded = false;
let loadError = '';
let pendingOpen = null;
let musicNoticeTimer = 0;
let musicVolumeOpen = false;
const blockCache = new Map(); // `${storyId}/${chapterId}` -> blocks[]

const getStory = (id) => stories.find((s) => s.id === id) || null;
const getChapter = (storyId, chapterId) => getStory(storyId)?.chapters.find((c) => c.id === chapterId) || null;
const readable = (c) => c.status === 'published';
const dateLabel = (v) => (typeof v === 'string' ? v : '');
const MUSIC_RE = /^\[\[music:\s*(https?:\/\/[^\s|\]]+)\s*(?:\|\s*([^\]]*?))?\s*\]\]$/gm;

function chapterMusic(blocks) {
  return blocks.flatMap((block) => {
    const text = String(block.text || '').replace(/\r\n/g, '\n');
    const tracks = [];
    for (const match of text.matchAll(MUSIC_RE)) {
      tracks.push({ url: match[1], title: (match[2] || '').trim() || 'Story music' });
    }
    return tracks;
  });
}

function syncStoryMusicUi() {
  const state = getMusicState();
  const player = root?.querySelector('.stories-music');
  if (player) {
    const alert = root.querySelector('.stories-music-notice');
    const message = player.querySelector('.stories-music__message');
    const playButton = player.querySelector('.stories-music__play');
    const muteButton = player.querySelector('.stories-music__mute');
    const volume = player.querySelector('[data-music-volume]');
    player.hidden = !state.url;
    if (alert && state.error) {
      alert.textContent = state.error;
      alert.hidden = false;
      clearTimeout(musicNoticeTimer);
      musicNoticeTimer = setTimeout(() => { alert.hidden = true; }, 5000);
    }
    if (message) message.textContent = state.title || 'Musik cerita';
    if (playButton) {
      playButton.textContent = state.playing ? 'Ⅱ' : '▶';
      playButton.setAttribute('aria-label', state.playing ? 'Jeda musik' : 'Putar musik');
    }
    if (muteButton) {
      muteButton.innerHTML = state.muted
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Zm13-1 5 6m0-6-5 6" /></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Zm11-1a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" /></svg>';
      muteButton.setAttribute('aria-label', state.muted ? 'Nyalakan suara' : 'Matikan suara');
      muteButton.setAttribute('aria-pressed', String(state.muted));
      muteButton.classList.toggle('is-muted', state.muted);
    }
    if (volume && document.activeElement !== volume) volume.value = String(Math.round(state.volume * 100));
    const volumePanel = player.querySelector('.stories-music__volume');
    const volumeToggle = player.querySelector('.stories-music__volume-toggle');
    if (volumePanel) volumePanel.hidden = !musicVolumeOpen;
    if (volumeToggle) volumeToggle.setAttribute('aria-expanded', String(musicVolumeOpen));
  }
  root?.querySelectorAll('.rt-music').forEach((card) => {
    const button = card.querySelector('.rt-music__toggle');
    const seek = card.querySelector('[data-music-seek]');
    const status = card.querySelector('[data-music-status]');
    if (!button || !seek || !status) return;
    const active = button.dataset.url === state.url;
    button.textContent = active && state.playing ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', active && state.playing ? 'Jeda lagu' : `Putar ${button.dataset.title}`);
    seek.disabled = !active || !state.duration;
    seek.max = active ? String(Math.floor(state.duration)) : '0';
    if (document.activeElement !== seek) seek.value = active ? String(Math.floor(state.currentTime)) : '0';
    status.textContent = active ? state.error || `${Math.floor(state.currentTime / 60)}:${String(Math.floor(state.currentTime % 60)).padStart(2, '0')}` : '';
  });
}

async function loadStories() {
  if (loading) return;
  loading = true;
  loadError = '';
  renderStoryList();
  try {
    const snap = await getDocs(collection(db, 'stories'));
    const list = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((s) => s.status === 'published')
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    for (const s of list) {
      const cs = await getDocs(query(collection(db, 'stories', s.id, 'chapters'), orderBy('order', 'asc')));
      s.chapters = cs.docs.map((d) => ({ ...d.data(), id: d.id })).filter((c) => c.status !== 'draft');
    }
    stories = list;
    loaded = true;
  } catch (error) {
    console.error('Gagal mengambil cerita dari Firebase:', error);
    loadError = 'Cerita gagal dimuat. Periksa koneksi Firebase dan Firestore Rules.';
  } finally {
    loading = false;
    if (pendingOpen && loaded) {
      const p = pendingOpen;
      pendingOpen = null;
      openChapter(p.storyId, p.chapterId);
    } else renderStoryList();
  }
}

function renderStoryList() {
  if (!root) return;
  currentRef = null;

  if (loading) {
    root.innerHTML = `<div class="stories-app"><p class="stories-coming">Loading stories...</p></div>`;
    return;
  }
  if (loadError) {
    root.innerHTML = `
      <div class="stories-app">
        <h1>Stories</h1>
        <p>${esc(loadError)}</p>
        <button type="button" class="stories-read" data-action="reload-stories">Try again</button>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="stories-app">
      <header class="stories-header">
        <p class="eyebrow">YOUR READING SPACE</p>
        <h1>Stories</h1>
        <p>Read the story, one part at a time.</p>
      </header>
      ${
        stories.length
          ? stories
              .map(
                (s) => `<section class="stories-library">
        <article class="stories-book">
          <div class="stories-book__cover" aria-hidden="true">${
            s.coverUrl ? `<img src="${esc(s.coverUrl)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span>${esc((s.title || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase())}</span>`
          }</div>
          <div class="stories-book__info">
            <p class="stories-book__label">SERIAL STORY</p>
            <h2>${esc(s.title || 'Untitled')}</h2>
            <p>${esc(s.description || s.subtitle || 'A story told in parts.')}</p>
            <span class="stories-book__count">${s.chapters.length} parts</span>
          </div>
        </article>
        <div class="stories-chapters">
          <h2>Contents</h2>
          ${
            s.chapters.length
              ? s.chapters
                  .map((c, i) => {
                    const available = readable(c);
                    const num = String(c.part || '').match(/\d+/)?.[0] || String(i + 1);
                    return `<div class="stories-chapter">
                      <div class="stories-chapter__number">${esc(num.padStart(2, '0'))}</div>
                      <div class="stories-chapter__info">
                        <h3>${esc(c.title || 'Untitled')}</h3>
                        ${c.subtitle ? `<p>${esc(c.subtitle)}</p>` : ''}
                        ${c.location ? `<p class="stories-chapter__location">${esc(c.location)}</p>` : ''}
                        ${available ? '' : '<span class="stories-coming">Coming Soon</span>'}
                      </div>
                      ${
                        available
                          ? `<button type="button" class="stories-read" data-action="read-story-page" data-story="${esc(s.id)}" data-chapter="${esc(c.id)}">Read <span aria-hidden="true">↗</span></button>`
                          : '<span class="stories-locked">Soon</span>'
                      }
                    </div>`;
                  })
                  .join('')
              : '<p class="stories-coming">No parts yet.</p>'
          }
        </div>
      </section>`
              )
              .join('')
          : '<p class="stories-coming">No stories available yet.</p>'
      }
    </div>`;
}

async function openChapter(storyId, chapterId) {
  if (!loaded) {
    pendingOpen = { storyId, chapterId };
    return loadStories();
  }
  const story = getStory(storyId);
  if (!story) return renderStoryList();
  // Tanpa chapterId (mis. dari narasi/foto lama): buka bab terbit pertama.
  const chapter = (chapterId && getChapter(storyId, chapterId)) || story.chapters.find(readable);
  if (!chapter || !readable(chapter)) return renderStoryList();

  currentRef = { storyId: story.id, chapterId: chapter.id };
  const key = `${story.id}/${chapter.id}`;
  if (!blockCache.has(key)) {
    root.innerHTML = `<div class="stories-app"><p class="stories-coming">Loading chapter...</p></div>`;
    try {
      const snap = await getDocs(query(collection(db, 'stories', story.id, 'chapters', chapter.id, 'blocks'), orderBy('order', 'asc')));
      blockCache.set(key, snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    } catch (error) {
      console.error('Gagal memuat bab:', error);
      root.innerHTML = `<div class="stories-app"><h1>Stories</h1><p>Bab gagal dimuat. Periksa koneksi dan Firestore Rules.</p>
        <button type="button" class="stories-read" data-action="back-to-stories">← All stories</button></div>`;
      return;
    }
  }
  if (!currentRef || currentRef.chapterId !== chapter.id) return; // pengguna sudah pindah
  const blocks = blockCache.get(key);
  renderChapterPage(story, chapter, blocks);
  setMusicPlaylist(chapterMusic(blocks), { autoplay: true });
  syncStoryMusicUi();
}

function renderChapterPage(story, chapter, blocks) {
  const idx = story.chapters.findIndex((c) => c.id === chapter.id);
  const next = story.chapters.slice(idx + 1).find(readable);
  const tracks = chapterMusic(blocks);
  const hasMusic = tracks.length > 0;
  musicVolumeOpen = false;
  clearTimeout(musicNoticeTimer);
  root.innerHTML = `
    <div class="stories-app stories-app--reader">
      <nav class="stories-reader-nav">
        <button type="button" class="stories-back" data-action="back-to-stories">
          <span aria-hidden="true">←</span><span>All stories</span>
        </button>
        <span class="stories-reader-nav__part">${esc((chapter.part || '').toUpperCase())}</span>
      </nav>

      <article class="stories-reader">
        <header class="stories-reader__header" style="text-align:${chapterAlign(chapter)}">
          <p class="eyebrow">${esc((story.title || '').toUpperCase())}</p>
          <h1>${esc(chapter.title || '')}</h1>
          ${chapter.subtitle ? `<p class="stories-reader__sub">${esc(chapter.subtitle)}</p>` : ''}
          ${chapter.location ? `<p class="stories-reader__sub">${esc(chapter.location)}</p>` : ''}
          ${chapter.date ? `<p class="stories-reader__sub">${esc(dateLabel(chapter.date))}</p>` : ''}
        </header>

        ${blocks.length ? renderStoryBlocks(chapter, blocks) : '<p class="stories-coming">This part has no content yet.</p>'}

        <footer class="stories-reader__footer">
          ${next ? `<button type="button" class="stories-read" data-action="read-story-page" data-story="${esc(story.id)}" data-chapter="${esc(next.id)}">Next: ${esc(next.title || 'Untitled')} →</button>` : ''}
          <button type="button" class="stories-back" data-action="back-to-stories">← Back to contents</button>
        </footer>
      </article>
      <div class="stories-music-notice" role="status" aria-live="polite" hidden></div>
      <aside class="stories-music" aria-label="Kontrol musik cerita" ${hasMusic ? '' : 'hidden'}>
        <div class="stories-music__row">
          <span class="stories-music__art" aria-hidden="true">♫</span>
          <span class="stories-music__message"></span>
          <button type="button" class="stories-music__play" data-action="story-music-toggle" aria-label="Putar musik">Putar</button>
          <button type="button" class="stories-music__volume-toggle" data-action="story-music-volume" aria-label="Atur volume" aria-expanded="false">◖</button>
          <button type="button" class="stories-music__mute" data-action="story-music-mute" aria-label="Matikan suara">◖</button>
        </div>
        <label class="stories-music__volume" hidden><span>Volume</span><input type="range" min="0" max="100" step="1" value="80" data-music-volume aria-label="Volume musik"></label>
      </aside>
    </div>`;
  root.scrollTop = 0;
  if (hasMusic) {
    const notice = root.querySelector('.stories-music-notice');
    notice.textContent = `Part ini memiliki lagu: ${tracks[0].title}`;
    notice.hidden = false;
    musicNoticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  }
}

/** Dipakai foto/narasi: buka app Stories langsung di bab tertentu. */
export function openStoryChapter(storyId, chapterId) {
  pendingOpen = { storyId, chapterId };
  document.querySelector('.modal-backdrop .modal__close')?.click();
  openApp('stories');
  if (loaded) {
    const p = pendingOpen;
    pendingOpen = null;
    openChapter(p.storyId, p.chapterId);
  } else if (!loading) loadStories();
}

export function initStories(registerAction) {
  root = document.getElementById('app-stories');
  if (!root) return;

  registerAction('read-story-page', (el) => openChapter(el.dataset.story, el.dataset.chapter));
  registerAction('open-story-chapter', (el) => openStoryChapter(el.dataset.story, el.dataset.chapter));
  registerAction('back-to-stories', () => renderStoryList());
  registerAction('reload-stories', () => loadStories());
  registerAction('story-music-toggle', (el) => {
    toggleMusic(el.dataset.url, el.dataset.title).catch((error) => console.warn('Unable to play story music', error));
  });
  registerAction('story-music-mute', () => toggleMusicMute());
  registerAction('story-music-volume', () => {
    musicVolumeOpen = !musicVolumeOpen;
    syncStoryMusicUi();
  });

  initStoryLinks(registerAction);
  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-music-seek]')) seekMusic(Number(event.target.value));
    if (event.target.matches('[data-music-volume]')) setMusicVolume(Number(event.target.value) / 100);
  });
  onMusicChange(syncStoryMusicUi);

  registerApp('stories', {
    root,
    render: () => {
      if (currentRef && getChapter(currentRef.storyId, currentRef.chapterId) && blockCache.has(`${currentRef.storyId}/${currentRef.chapterId}`)) {
        renderChapterPage(getStory(currentRef.storyId), getChapter(currentRef.storyId, currentRef.chapterId), blockCache.get(`${currentRef.storyId}/${currentRef.chapterId}`));
        syncStoryMusicUi();
      } else if (!currentRef) renderStoryList();
    },
  });

  loadStories();
}