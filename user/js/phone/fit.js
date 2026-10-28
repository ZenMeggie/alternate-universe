// Skala perangkat mengikuti area tampil browser: ada header/footer -> mengecil,
// tidak ada -> membesar (maks 1.25x). Di layar sempit CSS memakai mode layar penuh dan mengabaikan nilai ini.
const FRAME_W = 421; // 393 + 2 * (4 + 10)
const FRAME_H = 880; // 852 + 2 * (4 + 10)
const MARGIN = 20;
const MAX_SCALE = 1.25;
const MIN_SCALE = 0.35;

export function initFit() {
  const phone = document.getElementById('phone');
  if (!phone) return;

  const fit = () => {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    const s = Math.min(MAX_SCALE, (h - MARGIN * 2) / FRAME_H, (w - MARGIN * 2) / FRAME_W);
    phone.style.setProperty('--phone-scale', Math.max(MIN_SCALE, s).toFixed(4));
  };

  fit();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
}
