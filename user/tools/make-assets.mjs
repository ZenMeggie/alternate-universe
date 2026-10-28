// Generates the SVG avatars and sample "photos" used by the story data.
// Run from the project root:  node tools/make-assets.mjs
// Replace any generated file with a real .jpg/.webp and update the path in js/data/*.js.
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('assets/avatars', { recursive: true });
mkdirSync('assets/photos', { recursive: true });

const W = 1200;
const H = 900;
const wrap = (defs, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${inner}</svg>`;
const stops = (list) => list.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');

/* ---------- people ---------- */
function person(x, y, s, o = {}) {
  const {
    shirt = '#2f7df6',
    skin = '#d9a074',
    hair = '#1c1c24',
    hairStyle = 'short',
    pants = '#2b3446',
    camera = false,
    wave = false,
    sitting = false,
  } = o;
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  if (hairStyle === 'long') g += `<rect x="-34" y="-290" width="68" height="150" rx="30" fill="${hair}"/>`;
  g += `<rect x="-30" y="-125" width="26" height="125" rx="10" fill="${pants}"/>`;
  g += `<rect x="4" y="-125" width="26" height="125" rx="10" fill="${pants}"/>`;
  g += `<rect x="-42" y="-232" width="84" height="124" rx="30" fill="${shirt}"/>`;
  g += `<line x1="-38" y1="-212" x2="-52" y2="-130" stroke="${shirt}" stroke-width="20" stroke-linecap="round"/>`;
  if (wave) {
    g += `<line x1="38" y1="-212" x2="74" y2="-286" stroke="${shirt}" stroke-width="20" stroke-linecap="round"/>`;
    g += `<circle cx="76" cy="-292" r="11" fill="${skin}"/>`;
  } else {
    g += `<line x1="38" y1="-212" x2="52" y2="-130" stroke="${shirt}" stroke-width="20" stroke-linecap="round"/>`;
  }
  g += `<rect x="-9" y="-252" width="18" height="26" rx="8" fill="${skin}"/>`;
  g += `<circle cx="0" cy="-272" r="29" fill="${skin}"/>`;
  if (hairStyle === 'short') {
    g += `<path d="M-30 -276 C-30 -308 30 -308 30 -276 C20 -292 -18 -292 -30 -276Z" fill="${hair}"/>`;
  } else if (hairStyle === 'long') {
    g += `<path d="M-31 -270 C-34 -312 34 -312 31 -270 C22 -294 -16 -294 -31 -270Z" fill="${hair}"/>`;
  } else if (hairStyle === 'curly') {
    for (let i = -2; i <= 2; i++) g += `<circle cx="${i * 12}" cy="${-296 + Math.abs(i) * 5}" r="13" fill="${hair}"/>`;
  } else if (hairStyle === 'bob') {
    g += `<path d="M-33 -262 C-38 -318 38 -318 33 -262 L33 -244 L22 -250 C20 -290 -20 -290 -22 -250 L-33 -244Z" fill="${hair}"/>`;
  }
  if (camera) {
    g += `<rect x="-30" y="-196" width="60" height="36" rx="8" fill="#14161c"/><circle cx="0" cy="-178" r="13" fill="#2b3446" stroke="#8a93a6" stroke-width="3"/>`;
    g += `<circle cx="-34" cy="-176" r="9" fill="${skin}"/><circle cx="34" cy="-176" r="9" fill="${skin}"/>`;
  }
  g += '</g>';
  if (sitting) {
    g += `<rect x="${x - 120 * s}" y="${y - 70 * s}" width="${240 * s}" height="${16 * s}" rx="${6 * s}" fill="#5b3f2e"/>`;
    g += `<rect x="${x - 120 * s}" y="${y - 150 * s}" width="${240 * s}" height="${12 * s}" rx="${6 * s}" fill="#5b3f2e" opacity=".0"/>`;
  }
  return g;
}

/* ---------- scenes ---------- */
function sunrise({ sunX, who }) {
  const horizon = 520;
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#2c3a6e'], [0.45, '#d9708a'], [1, '#ffc27a']])}</linearGradient>
    <radialGradient id="glow" cx="${sunX}" cy="${horizon - 20}" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff6cc" stop-opacity=".95"/><stop offset=".35" stop-color="#ffb36b" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a59" stop-opacity="0"/></radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#f2a273'], [0.35, '#486792'], [1, '#1b2c52']])}</linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#d9b58a'], [1, '#a98259']])}</linearGradient>`;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += `<circle cx="${sunX}" cy="${horizon - 20}" r="420" fill="url(#glow)"/>`;
  s += `<circle cx="${sunX}" cy="${horizon - 36}" r="62" fill="#fff4cf"/>`;
  s += `<rect y="${horizon}" width="${W}" height="260" fill="url(#sea)"/>`;
  for (let i = 0; i < 9; i++) {
    const w = 260 - i * 24;
    s += `<rect x="${sunX - w / 2}" y="${horizon + 10 + i * 22}" width="${w}" height="6" rx="3" fill="#ffe2a8" opacity="${0.75 - i * 0.07}"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const x = (i * 197) % W;
    const y = horizon + 40 + ((i * 53) % 190);
    s += `<rect x="${x}" y="${y}" width="${70 + (i % 4) * 22}" height="3" rx="1.5" fill="#ffffff" opacity=".18"/>`;
  }
  s += `<path d="M0 760 C300 735 700 790 1200 745 L1200 900 L0 900Z" fill="url(#sand)"/>`;
  // palm
  const palmX = who === 'raka-photo' ? 1010 : 170;
  s += `<path d="M${palmX} 800 C${palmX + 20} 640 ${palmX - 10} 520 ${palmX + 14} 380" stroke="#2b2433" stroke-width="16" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < 6; i++) {
    const a = -150 + i * 56;
    s += `<ellipse cx="${palmX + 14}" cy="380" rx="100" ry="16" fill="#1d2a2c" transform="rotate(${a} ${palmX + 14} 380) translate(86 0)"/>`;
  }
  if (who === 'raka-photo') {
    // Raka's photo: Nayla at the water's edge in a grey hoodie
    s += person(640, 835, 1.05, { shirt: '#9aa3b2', hair: '#14131a', hairStyle: 'long', pants: '#2b3446', wave: true });
  } else {
    // Nayla's photo: Raka, mid-motion, pretending to surf
    s += person(520, 840, 1.1, { shirt: '#2f7df6', hairStyle: 'short', pants: '#243049', wave: true });
    s += `<rect x="330" y="808" width="330" height="22" rx="11" fill="#f4e9d0" transform="rotate(-6 495 819)" opacity=".92"/>`;
  }
  return wrap(defs, s);
}

function bridge({ mood, figures }) {
  const golden = mood === 'golden';
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops(
      golden
        ? [[0, '#3b3f7a'], [0.4, '#e0708f'], [0.75, '#ffb867'], [1, '#ffd89a']]
        : [[0, '#79b8f2'], [0.6, '#b9dcf7'], [1, '#e9f3fb']]
    )}</linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">${stops(
      golden ? [[0, '#e49b78'], [0.4, '#445f8c'], [1, '#1a2a4e']] : [[0, '#6aa6c9'], [1, '#2f6b92']]
    )}</linearGradient>`;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (golden) s += `<circle cx="860" cy="470" r="70" fill="#fff0c2" opacity=".95"/>`;
  else s += `<circle cx="960" cy="150" r="54" fill="#fffbe0" opacity=".95"/>`;
  s += `<rect y="560" width="${W}" height="340" fill="url(#sea)"/>`;
  const ink = golden ? '#1b1d33' : '#33465c';
  // far hills
  s += `<path d="M0 560 C150 520 260 540 380 556 C520 520 640 548 760 558 L760 570 L0 570Z" fill="${golden ? '#3a2f4e' : '#6f8fa8'}" opacity=".7"/>`;
  // deck
  s += `<path d="M0 596 Q600 560 1200 596 L1200 616 Q600 580 0 616Z" fill="${ink}"/>`;
  // pylon
  s += `<polygon points="560,586 576,160 624,160 640,586" fill="${ink}"/>`;
  s += `<rect x="552" y="300" width="96" height="14" fill="${ink}"/>`;
  for (let i = 1; i <= 9; i++) {
    const dx = i * 58;
    const y = 580 - Math.sin((dx / 600) * 1.2) * 30;
    s += `<line x1="600" y1="${172 + i * 16}" x2="${600 - dx}" y2="${y + 4}" stroke="${golden ? '#ffe3b0' : '#ffffff'}" stroke-width="2" opacity=".75"/>`;
    s += `<line x1="600" y1="${172 + i * 16}" x2="${600 + dx}" y2="${y + 4}" stroke="${golden ? '#ffe3b0' : '#ffffff'}" stroke-width="2" opacity=".75"/>`;
  }
  if (golden) for (let i = 0; i < 28; i++) s += `<circle cx="${20 + i * 43}" cy="${600 - Math.sin((i * 43) / 380) * 4 - 22}" r="3.2" fill="#ffe7a8"/>`;
  // reflection
  for (let i = 0; i < 7; i++) s += `<rect x="${590 - i * 6}" y="${640 + i * 26}" width="${24 + i * 12}" height="5" rx="2.5" fill="${golden ? '#ffd27a' : '#ffffff'}" opacity="${0.45 - i * 0.05}"/>`;
  // foreground walkway + rail
  s += `<rect y="760" width="${W}" height="140" fill="${golden ? '#2a2236' : '#8d98a6'}"/>`;
  s += `<rect y="738" width="${W}" height="14" fill="${golden ? '#3b2f4a' : '#aab4bf'}"/>`;
  for (let i = 0; i < 24; i++) s += `<rect x="${i * 52 + 6}" y="738" width="7" height="30" fill="${golden ? '#3b2f4a' : '#aab4bf'}"/>`;
  for (const f of figures) s += person(f.x, f.y, f.s, f.o);
  return wrap(defs, s);
}

function park() {
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#2a2650'], [0.55, '#7a5a9a'], [1, '#e79a8c']])}</linearGradient>
  <radialGradient id="lamp"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></radialGradient>`;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += `<circle cx="210" cy="170" r="38" fill="#fdf3d2" opacity=".9"/>`;
  s += `<rect y="560" width="${W}" height="340" fill="#25402f"/>`;
  s += `<path d="M360 900 C470 760 640 700 760 560 L860 560 C760 720 760 800 840 900Z" fill="#cdb79c" opacity=".9"/>`;
  const trees = [[110, 520, 130], [300, 500, 150], [930, 500, 160], [1100, 530, 120]];
  for (const [x, y, r] of trees) {
    s += `<rect x="${x - 10}" y="${y}" width="20" height="${580 - y}" fill="#2c1f22"/>`;
    s += `<circle cx="${x}" cy="${y - 20}" r="${r}" fill="#1b3a2c"/><circle cx="${x - r / 2}" cy="${y + 10}" r="${r * 0.7}" fill="#21452f"/><circle cx="${x + r / 2}" cy="${y + 4}" r="${r * 0.7}" fill="#1e4030"/>`;
  }
  for (const x of [520, 1010]) {
    s += `<circle cx="${x}" cy="440" r="130" fill="url(#lamp)"/>`;
    s += `<rect x="${x - 5}" y="450" width="10" height="170" fill="#16151f"/><circle cx="${x}" cy="440" r="14" fill="#ffe7a8"/>`;
  }
  s += person(300, 790, 1.15, { shirt: '#c7567a', hairStyle: 'long', hair: '#15121a', pants: '#2b3446', sitting: true });
  s += `<rect x="150" y="700" width="300" height="190" fill="none"/>`;
  s += `<rect x="262" y="612" width="76" height="46" rx="8" fill="#e9f4ff" opacity=".95" transform="rotate(-8 300 635)"/>`;
  s += `<rect x="170" y="722" width="260" height="14" rx="6" fill="#5b3f2e"/>`;
  s += `<rect x="188" y="736" width="12" height="60" fill="#3d291d"/><rect x="400" y="736" width="12" height="60" fill="#3d291d"/>`;
  return wrap(defs, s);
}

/* ---------- avatars ---------- */
function avatar({ bg1, bg2, skin, hair, hairStyle, shirt, glasses = false, beard = false }) {
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${stops([[0, bg1], [1, bg2]])}</linearGradient>`;
  let s = `<rect width="400" height="400" fill="url(#bg)"/>`;
  s += `<circle cx="330" cy="70" r="120" fill="#ffffff" opacity=".10"/>`;
  s += `<path d="M60 400 C60 300 130 270 200 270 C270 270 340 300 340 400Z" fill="${shirt}"/>`;
  s += `<rect x="176" y="236" width="48" height="56" rx="18" fill="${skin}"/>`;
  if (hairStyle === 'long') s += `<path d="M120 190 C110 90 290 90 280 190 L296 330 L250 330 L250 190 L150 190 L150 330 L104 330Z" fill="${hair}"/>`;
  s += `<ellipse cx="200" cy="190" rx="76" ry="88" fill="${skin}"/>`;
  if (hairStyle === 'short') s += `<path d="M122 176 C118 90 282 90 278 176 C262 138 150 132 122 176Z" fill="${hair}"/>`;
  if (hairStyle === 'long') s += `<path d="M124 186 C120 96 280 96 276 186 C250 140 170 136 124 186Z" fill="${hair}"/>`;
  if (hairStyle === 'curly') for (let i = 0; i < 7; i++) s += `<circle cx="${130 + i * 23}" cy="${118 + Math.abs(3 - i) * 7}" r="28" fill="${hair}"/>`;
  if (hairStyle === 'bob') s += `<path d="M116 210 C100 80 300 80 284 210 L284 236 L262 232 C262 150 138 150 138 232 L116 236Z" fill="${hair}"/>`;
  if (beard) s += `<path d="M140 220 C150 280 250 280 260 220 C240 246 160 246 140 220Z" fill="${hair}" opacity=".95"/>`;
  s += `<circle cx="168" cy="196" r="7" fill="#1b1b22"/><circle cx="232" cy="196" r="7" fill="#1b1b22"/>`;
  s += `<path d="M172 236 Q200 256 228 236" stroke="#7a3b32" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  if (glasses) s += `<g fill="none" stroke="#1b1b22" stroke-width="5"><circle cx="168" cy="196" r="22"/><circle cx="232" cy="196" r="22"/><line x1="190" y1="196" x2="210" y2="196"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs>${defs}</defs>${s}</svg>`;
}

const out = (path, svg) => writeFileSync(path, svg);

out('assets/avatars/raka.svg', avatar({ bg1: '#4d8dff', bg2: '#1f4fc2', skin: '#d9a074', hair: '#17161d', hairStyle: 'short', shirt: '#25314f' }));
out('assets/avatars/nayla.svg', avatar({ bg1: '#ff9a8b', bg2: '#c14a8c', skin: '#e0ad84', hair: '#15121a', hairStyle: 'long', shirt: '#f3e6d8' }));
out('assets/avatars/bagas.svg', avatar({ bg1: '#5ad1a5', bg2: '#1f8a6a', skin: '#c98d62', hair: '#1a1411', hairStyle: 'curly', shirt: '#33443b', beard: true }));
out('assets/avatars/dinda.svg', avatar({ bg1: '#ffd36b', bg2: '#f08a3c', skin: '#e3b48f', hair: '#2a1b17', hairStyle: 'bob', shirt: '#5a4a8f', glasses: true }));

out('assets/photos/nongsa-sunrise-raka.svg', sunrise({ sunX: 560, who: 'raka-photo' }));
out('assets/photos/nongsa-sunrise-nayla.svg', sunrise({ sunX: 700, who: 'nayla-photo' }));
out(
  'assets/photos/barelang-scouting.svg',
  bridge({ mood: 'day', figures: [{ x: 880, y: 880, s: 1.05, o: { shirt: '#33443b', hairStyle: 'curly', hair: '#1a1411', pants: '#2b3446', wave: true } }] })
);
out('assets/photos/park-evening.svg', park());
out(
  'assets/photos/barelang-golden-wide.svg',
  bridge({
    mood: 'golden',
    figures: [
      { x: 470, y: 872, s: 0.9, o: { shirt: '#2f7df6', hairStyle: 'short', pants: '#243049' } },
      { x: 600, y: 872, s: 0.86, o: { shirt: '#f3e6d8', hairStyle: 'long', hair: '#15121a', pants: '#2b3446' } },
    ],
  })
);
out(
  'assets/photos/barelang-golden-close.svg',
  bridge({
    mood: 'golden',
    figures: [
      { x: 430, y: 900, s: 1.45, o: { shirt: '#2f7df6', hairStyle: 'short', pants: '#243049', wave: true } },
      { x: 700, y: 900, s: 1.38, o: { shirt: '#f3e6d8', hairStyle: 'long', hair: '#15121a', pants: '#2b3446' } },
    ],
  })
);

console.log('Assets written to assets/avatars and assets/photos');
