// Masuk fullscreen browser saat pemain menekan "Open the phone" (butuh klik pengguna),
// dan keluar lagi saat kembali ke menu cerita. Gagal diam-diam di browser yang tidak mendukung
// (mis. iPhone Safari): CSS tetap mengisi seluruh area tampil.
import { getState, subscribe } from '../state.js';

const root = document.documentElement;

function enter() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  try { req?.call(root)?.catch?.(() => {}); } catch { /* abaikan */ }
}

function leave() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try { exit?.call(document)?.catch?.(() => {}); } catch { /* abaikan */ }
}

export function initFullscreen() {
  // capture: jalan sebelum handler navigasi, masih dalam konteks klik pengguna
  document.addEventListener('click', (e) => {
    if (getState().view !== 'landing') return;
    if (e.target.closest('[data-action="nav"][data-route="home"]')) enter();
  }, true);

  subscribe((state, changed) => {
    if (changed.includes('view') && state.view === 'landing') leave();
  });
}