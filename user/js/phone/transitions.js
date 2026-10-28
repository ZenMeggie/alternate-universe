// Animasi buka app: app membesar dari posisi ikonnya di home screen (seperti iOS).
// Kalau ikon tidak ditemukan (mis. dibuka dari notifikasi), app hanya zoom-in halus.
import { subscribe } from '../state.js';
import { $ } from '../utils.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;


function openFrom(name, tries = 0) {
  const el = $(`#app-${name}`);
  const screen = $('#phone-screen');
  if (!el || !screen) return;

  if (el.hidden) {
    if (tries < 3) requestAnimationFrame(() => openFrom(name, tries + 1));
    return;
  }

  const sr = screen.getBoundingClientRect();
  const btn = [...document.querySelectorAll('.ios-icon')]
    .find((b) => b.dataset.app === name);

  const ir = (btn?.querySelector('.app-tile') || btn)
    ?.getBoundingClientRect();

  let from;
  let startTransformOrigin = 'center center';

  if (ir && ir.width > 0 && sr.width > 0) {
    const scale = ir.width / sr.width;
    const dx = ir.left + ir.width / 2 - (sr.left + sr.width / 2);
    const dy = ir.top + ir.height / 2 - (sr.top + sr.height / 2);

    from = {
      transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
      borderRadius: `${14 / scale}px`,
      opacity: 0.7,
      filter: 'blur(1px)',
    };
  } else {
    from = {
      transform: 'scale(.88)',
      borderRadius: '28px',
      opacity: 0,
      filter: 'blur(3px)',
    };
  }

  if (reduced()) return;

  el.animate(
    [
      from,
      {
        transform: 'scale(1.015)',
        borderRadius: '2px',
        opacity: 1,
        filter: 'blur(0px)',
        offset: 0.78,
      },
      {
        transform: 'scale(1)',
        borderRadius: '0px',
        opacity: 1,
        filter: 'blur(0px)',
      },
    ],
    {
      duration: 480,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'none',
    }
  );
}

export function initTransitions() {
  subscribe((s, changed) => {
    if (!changed.includes('activeApp') || !s.activeApp || reduced()) return;
    const name = s.activeApp;
    queueMicrotask(() => openFrom(name)); // sebelum frame berikutnya digambar, jadi tidak berkedip
  });
}