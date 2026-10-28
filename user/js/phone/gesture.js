// Gestur ala iOS yang MENGIKUTI JARI (bukan lompat):
//  - geser indikator home ke atas  : app mengecil mengikuti jari, lepas -> tutup / kembali
//  - tarik status bar ke bawah     : Notification Center (kiri) / Control Center (kanan) ikut jari
//  - geser sheet ke atas           : sheet menutup mengikuti jari
//  - geser dari tepi kiri          : kembali
// Semua animasi memakai transform saja (GPU), jadi halus.
import { $ } from '../utils.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const phone = () => $('#phone-screen');
const scrim = () => $('.sheet-scrim');
const screenH = () => phone()?.clientHeight || 800;

/* ---------- helper drag generik ---------- */
function swallowClick() {
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, true);
  setTimeout(() => window.removeEventListener('click', stop, true), 60);
}

function drag(el, { shouldStart, onStart, onMove, onEnd, onTap, threshold = 6 }) {
  let id = null, sx = 0, sy = 0, started = false, pts = [];

  const push = (e) => { pts.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (pts.length > 12) pts.shift(); };
  const vel = () => {
    const n = pts.length;
    if (n < 2) return { vx: 0, vy: 0 };
    const b = pts[n - 1];
    let a = pts[0];
    for (const p of pts) if (b.t - p.t <= 100) { a = p; break; }
    const dt = Math.max(1, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt }; // px per ms
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || (shouldStart && !shouldStart(e))) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; started = false; pts = []; push(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    push(e);
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!started) {
      if (Math.hypot(dx, dy) < threshold) return;
      if (!onStart(dx, dy, e)) { id = null; return; }
      started = true;
      try { el.setPointerCapture(id); } catch { /* abaikan */ }
    }
    onMove(dx, dy, vel());
  });
  const end = (e, cancelled) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const was = started;
    id = null; started = false;
    if (!was) { if (!cancelled) onTap?.(e); return; }
    swallowClick();
    onEnd(dx, dy, vel(), cancelled);
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
}

/* ---------- sheet ---------- */
const place = (el, f) => {
  el.style.transform = `translateY(${-(1 - f) * 105}%)`;
  const s = scrim();
  if (s) s.style.opacity = String(f);
};
const release = (el) => {
  el.classList.remove('is-dragging');
  el.style.transform = '';
  const s = scrim();
  if (s) s.style.opacity = '';
};

/* ---------- app ---------- */
const resetApp = (app, view) => {
  app.classList.remove('is-dragging');
  for (const k of ['transition', 'transform', 'opacity', 'borderRadius']) app.style[k] = '';
  view?.style.removeProperty('--drag');
};

export function initGestures(api) {
  const root = phone();
  if (!root) return;

  /* --- 1. status bar: tarik ke bawah membuka sheet --- */
  for (const [zone, name] of [['notif', 'notif'], ['control', 'control']]) {
    const el = root.querySelector(`[data-zone="${zone}"]`);
    let sheet = null, H = 1, f = 0;
    drag(el, {
      onStart(dx, dy) {
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx)) return false;
        sheet = api.prepareSheet(name);
        sheet.classList.add('is-dragging');
        H = sheet.offsetHeight || screenH();
        f = 0;
        place(sheet, 0);
        return true;
      },
      onMove(_dx, dy) { f = clamp(dy / (H * 0.55), 0, 1); place(sheet, f); },
      onEnd(_dx, _dy, v, cancelled) {
        const open = !cancelled && (f > 0.35 || v.vy > 0.5);
        release(sheet);
        api.finishSheet(name, open);
      },
      onTap() { api.toggleSheet(name); },
    });
  }

  /* --- 2. sheet: geser ke atas menutup --- */
  for (const name of ['notif', 'control']) {
    const el = $(`#sheet-${name}`);
    let H = 1, f = 1;
    drag(el, {
      shouldStart: (e) =>
        api.openSheet() === name &&
        !e.target.closest('.cc-slider') &&
        // notifikasi bisa di-scroll: di layar sentuh hanya handle bawah yang menutup; mouse bebas
        (name === 'control' || e.pointerType === 'mouse' || !!e.target.closest('.sheet__grab')),
      onStart(dx, dy) {
        if (dy >= 0 || Math.abs(dy) < Math.abs(dx)) return false;
        el.classList.add('is-dragging');
        H = el.offsetHeight || screenH();
        f = 1;
        return true;
      },
      onMove(_dx, dy) { f = clamp(1 + dy / (H * 0.6), 0, 1); place(el, f); },
      onEnd(_dx, _dy, v, cancelled) {
        const close = !cancelled && (f < 0.65 || v.vy < -0.5);
        release(el);
        api.finishSheet(name, !close);
      },
    });
  }

  /* --- 3. indikator home: geser ke atas --- */
  const home = root.querySelector('[data-zone="home"]');
  let mode = null, ctx = {};
  drag(home, {
    onStart(dx, dy) {
      if (dy >= 0 || Math.abs(dy) < Math.abs(dx)) return false;

      const name = api.openSheet();
      if (name) { // sheet terbuka: indikator menutup sheet
        const el = $(`#sheet-${name}`);
        el.classList.add('is-dragging');
        ctx = { name, el, H: el.offsetHeight || screenH(), f: 1 };
        mode = 'sheet';
        return true;
      }

      const app = document.querySelector('#app-layer .app.is-open');
      if (!app) return false; // di home screen tidak ada yang ditutup
      const view = $('#view-home');
      resetApp(app, view);
      app.classList.add('is-dragging');
      root.classList.add('is-gesturing');
      ctx = { app, view, H: screenH(), p: 0 };
      mode = 'app';
      return true;
    },
    onMove(dx, dy) {
      if (mode === 'sheet') {
        ctx.f = clamp(1 + dy / (ctx.H * 0.6), 0, 1);
        place(ctx.el, ctx.f);
      } else if (mode === 'app') {
        const p = clamp(-dy / (ctx.H * 0.55), 0, 1);
        ctx.p = p;
        ctx.app.style.transform = `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(${1 - 0.3 * p})`;
        ctx.app.style.borderRadius = `${Math.round(55 * p)}px`;
        ctx.view?.style.setProperty('--drag', p.toFixed(3));
      }
    },
    onEnd(dx, dy, v, cancelled) {
      if (mode === 'sheet') {
        const close = !cancelled && (ctx.f < 0.65 || v.vy < -0.5);
        release(ctx.el);
        api.finishSheet(ctx.name, !close);
      } else if (mode === 'app') {
        const { app, view } = ctx;
        const commit = !cancelled && (ctx.p > 0.28 || v.vy < -0.55);
        root.classList.remove('is-gesturing');
        app.classList.remove('is-dragging');
        if (commit) {
          app.style.transition = 'transform .32s cubic-bezier(.25,.8,.25,1), opacity .28s ease, border-radius .3s ease';
          app.style.transform = `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(.3)`;
          app.style.opacity = '0';
          app.style.borderRadius = '55px';
          setTimeout(() => api.goHome(), 170);
          setTimeout(() => resetApp(app, view), 620);
        } else {
          app.style.transition = 'transform .38s cubic-bezier(.2,.9,.3,1), border-radius .38s ease';
          app.style.transform = '';
          app.style.borderRadius = '';
          view?.style.setProperty('--drag', '0');
          setTimeout(() => resetApp(app, view), 440);
        }
      }
      mode = null;
      ctx = {};
    },
    onTap() { api.goHome(); }, // tap di indikator tetap kembali ke home (kenyamanan desktop)
  });

  /* --- 4. tepi kiri: kembali --- */
  const edge = root.querySelector('[data-zone="edge"]');
  drag(edge, {
    onStart: (dx, dy) => dx > 0 && Math.abs(dx) > Math.abs(dy),
    onMove() {},
    onEnd(dx, _dy, v, cancelled) { if (!cancelled && (dx > 70 || v.vx > 0.5)) api.goBack(); },
  });
}