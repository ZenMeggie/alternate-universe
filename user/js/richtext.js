import { esc } from './utils.js';

const ALIGN_RE = /^:(left|center|right|justify):[ \t]*/;
const MUSIC_RE = /^\[\[music:\s*(https?:\/\/[^\s|\]]+)\s*(?:\|\s*([^\]]*?))?\s*\]\]$/;

const inline = (s) =>
  esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

function musicCard(url, title) {
  return `<div class="rt-music">
    <div class="rt-music__head"><span class="rt-music__ico" aria-hidden="true">🎵</span><span class="rt-music__title">${esc(title || 'Putar musik')}</span>
      <button type="button" class="rt-music__toggle" data-action="story-music-toggle" data-url="${esc(url)}" data-title="${esc(title || 'Story music')}" aria-label="Putar ${esc(title || 'musik cerita')}">▶</button>
    </div>
    <input class="rt-music__seek" type="range" min="0" max="0" step="1" value="0" data-music-seek aria-label="Posisi lagu">
    <small class="rt-music__status" data-music-status></small>
  </div>`;
}

/** Teks → <p> per paragraf. Paragraf dipisah baris kosong; awalan :center: dst. mengatur rata teks. */
export function richText(text, defaultAlign = 'left', cls = 'rt-p') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const music = p.match(MUSIC_RE);
      if (music) return musicCard(music[1], music[2]);
      let al = defaultAlign;
      const m = p.match(ALIGN_RE);
      if (m) {
        al = m[1];
        p = p.slice(m[0].length);
      }
      return `<p class="${cls} align-${al}" style="text-align:${al}">${inline(p)}</p>`;
    })
    .join('');
}