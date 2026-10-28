// Scroll roda mouse yang halus (easing) di dalam layar ponsel.
// Hanya menangani roda mouse bertingkat; trackpad dan layar sentuh tetap memakai scroll bawaan (sudah halus).
const canScroll = (el, dy) => {
  const st = getComputedStyle(el);
  if (!/(auto|scroll)/.test(st.overflowY)) return false;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  return dy < 0 ? el.scrollTop > 0 : el.scrollTop < max - 1;
};

export function initSmoothScroll() {
  const root = document.getElementById('phone-screen');
  if (!root) return;
  const anim = new WeakMap();

  root.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.deltaMode !== 0 || Math.abs(e.deltaY) < 30 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    let el = e.target;
    while (el && el !== root && !canScroll(el, e.deltaY)) el = el.parentElement;
    if (!el || el === root) return;

    e.preventDefault();
    let s = anim.get(el);
    if (!s) { s = { target: el.scrollTop, raf: 0 }; anim.set(el, s); }
    if (!s.raf) s.target = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    s.target = Math.max(0, Math.min(max, s.target + e.deltaY));

    if (s.raf) return;
    el.style.scrollBehavior = 'auto'; // matikan smooth CSS selama animasi kita
    const tick = () => {
      const d = s.target - el.scrollTop;
      if (Math.abs(d) < 0.5) {
        el.scrollTop = s.target;
        s.raf = 0;
        el.style.scrollBehavior = '';
        return;
      }
      el.scrollTop += Math.sign(d) * Math.max(1, Math.abs(d) * 0.16);
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }, { passive: false });
}