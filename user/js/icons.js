// SVG icons (no emoji, no icon font). Brand glyphs are single-colour paths; app tiles are the home-screen icons (gaya iOS).

const X_PATH =
  'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z';

const WHATSAPP_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

/** Filled brand glyphs, drawn in currentColor. */
export const brand = (name, size = 20) => {
  const path = name === 'x' ? X_PATH : WHATSAPP_PATH;
  return `<svg class="ico ico--brand" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
};

const FONT = "font-family=\"-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif\"";
const R = 14; // radius sudut ikon iOS (~22% dari 64)

const PETALS = ['#ff3b30', '#ff9500', '#ffcc00', '#a6d608', '#34c759', '#32ade6', '#5856d6', '#c644fc'];
const petals = PETALS.map(
  (color, i) =>
    `<ellipse cx="32" cy="19.5" rx="7" ry="11.5" fill="${color}" opacity=".9" transform="rotate(${i * 45} 32 32)" style="mix-blend-mode:multiply"/>`
).join('');

const notesLines = [34, 41, 48, 55].map((y) => `<line x1="9" y1="${y}" x2="55" y2="${y}" stroke="#e1e1e6" stroke-width="1.2"/>`).join('');

const gearTeeth = Array.from({ length: 12 }, (_, i) => `<rect x="28" y="8" width="8" height="12" rx="3" transform="rotate(${i * 30} 32 32)"/>`).join('');
/** Cincin bergigi runcing: n gigi dari radius rBase ke rTip, lubang bulat di radius rHole (evenodd). */
const gearRing = (n, rBase, rTip, rHole, cx = 32) => {
  const step = (Math.PI * 2) / n;
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cx + r * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${pt(rBase, a)}L${pt(rTip, a + step / 2)}L${pt(rBase, a + step)}`;
  }
  d += 'Z';
  d += `M${cx + rHole} ${cx}A${rHole} ${rHole} 0 1 0 ${cx - rHole} ${cx}A${rHole} ${rHole} 0 1 0 ${cx + rHole} ${cx}Z`;
  return d;
};
const gearOuter = gearRing(48, 23.4, 27.4, 18.6);
const gearInner = gearRing(40, 14.2, 17.2, 10.2);
const spokes = [0, 120, 240]
  .map((deg) => `<rect x="32" y="30.4" width="19.5" height="3.2" rx="1.2" transform="rotate(${deg} 32 32)"/>`)
  .join('');
/** Home-screen app tiles (64×64 rounded squares, gaya iOS). */
export const appTiles = {
  notes: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g-notes" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ffcc00"/></linearGradient></defs>
    <rect width="64" height="64" rx="${R}" fill="#fff"/>
    <path d="M0 ${R}A${R} ${R} 0 0 1 ${R} 0h${64 - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v13H0z" fill="url(#g-notes)"/>
    ${notesLines}
    <rect x="9" y="8" width="24" height="3.2" rx="1.6" fill="#fff" opacity=".7"/>
    <rect x="9" y="15" width="16" height="3.2" rx="1.6" fill="#fff" opacity=".5"/>
  </svg>`,

  whatsapp: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g-wa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#61fd7d"/><stop offset="1" stop-color="#2bb826"/></linearGradient></defs>
    <rect width="64" height="64" rx="${R}" fill="url(#g-wa)"/>
    <g transform="translate(13 13) scale(1.58)" fill="#fff"><path d="${WHATSAPP_PATH}"/></g>
  </svg>`,

  gallery: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="${R}" fill="#fff"/>${petals}</svg>`,

  twitter: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="${R}" fill="#000"/>
    <g transform="translate(18.5 18.5) scale(1.15)" fill="#fff"><path d="${X_PATH}"/></g>
  </svg>`,

  stories: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g-st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f43"/><stop offset="1" stop-color="#ff6b35"/></linearGradient></defs>
    <rect width="64" height="64" rx="${R}" fill="url(#g-st)"/>
    <path d="M32 18c-4-3-10-3.500-16-2v28c6-1.500 12-1 16 2 4-3 10-3.500 16-2V16c-6-1.500-12-1-16 2z" fill="#fff"/>
    <path d="M32 18v28" stroke="#ff8a4c" stroke-width="1.8"/>
  </svg>`,

  music: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g-music" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb5c74"/><stop offset="1" stop-color="#fa233b"/></linearGradient></defs>
    <rect width="64" height="64" rx="${R}" fill="url(#g-music)"/>
    <path d="M42 14.5 27 18a2 2 0 0 0-1.5 2v20.2a7.5 7.5 0 1 0 4 6.6V25.6l9.5-2.2v12.8a7.5 7.5 0 1 0 4 6.6V16.5a2 2 0 0 0-2.5-2z" fill="#fff"/>
  </svg>`,

  settings: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="g-set" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9cacf"/><stop offset="1" stop-color="#989a9f"/></linearGradient>
      <linearGradient id="g-gear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ececef"/><stop offset="1" stop-color="#a6a8ae"/></linearGradient>
    </defs>
    <rect width="64" height="64" rx="${R}" fill="url(#g-set)"/>
    <circle cx="32" cy="32" r="28.8" fill="#2b2b2e"/>
    <g fill="url(#g-gear)">
      <path fill-rule="evenodd" d="${gearOuter}"/>
      <path fill-rule="evenodd" d="${gearInner}"/>
      ${spokes}
      <circle cx="32" cy="32" r="2.6"/>
    </g>
    <circle cx="32" cy="32" r="1" fill="#2b2b2e"/>
  </svg>`,

  // Kunci "calender" dipertahankan agar kode lain tidak rusak. Ubah teks hari/tanggal di bawah sesuai cerita.
  calender: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="${R}" fill="#fff"/>
    <text x="32" y="19" text-anchor="middle" ${FONT} font-size="10" font-weight="600" letter-spacing=".5" fill="#ff3b30">THU</text>
    <text x="32" y="51" text-anchor="middle" ${FONT} font-size="33" font-weight="300" fill="#111">23</text>
  </svg>`,

  calculator: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g-calc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3c"/><stop offset="1" stop-color="#1c1c1e"/></linearGradient></defs>
    <rect width="64" height="64" rx="${R}" fill="url(#g-calc)"/>
    <g fill="#a5a5a5">
      <rect x="9" y="30" width="10" height="7.500" rx="3.750"/><rect x="21.500" y="30" width="10" height="7.500" rx="3.750"/><rect x="34" y="30" width="10" height="7.500" rx="3.750"/>
    </g>
    <g fill="#505050">
      <rect x="9" y="39.500" width="10" height="7.500" rx="3.750"/><rect x="21.500" y="39.500" width="10" height="7.500" rx="3.750"/><rect x="34" y="39.500" width="10" height="7.500" rx="3.750"/>
      <rect x="9" y="49" width="22.500" height="7.500" rx="3.750"/><rect x="34" y="49" width="10" height="7.500" rx="3.750"/>
    </g>
    <g fill="#ff9f0a">
      <rect x="46.500" y="30" width="8.500" height="7.500" rx="3.750"/><rect x="46.500" y="39.500" width="8.500" height="7.500" rx="3.750"/><rect x="46.500" y="49" width="8.500" height="7.500" rx="3.750"/>
    </g>
    <text x="55" y="24" text-anchor="end" ${FONT} font-size="15" font-weight="300" fill="#fff">0</text>
  </svg>`,
};

const STROKE = {
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  repost: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  doubleCheck: '<polyline points="1 13 6 18 16 7"/><polyline points="9 16 11 18 22 7"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
};

/** Stroke icons (24×24 grid). `fill` turns the shape solid (e.g. a liked heart). */
export function icon(name, size = 20, { fill = false, className = '' } = {}) {
  const body = STROKE[name] || '';
  return `<svg class="ico ${className}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const APP_META = {
  notes: { title: 'Notes', tile: appTiles.notes },
  stories: { title: 'Stories', tile: appTiles.stories },
  music: { title: 'Music', tile: appTiles.music },
  whatsapp: { title: 'WhatsApp', tile: appTiles.whatsapp },
  twitter: { title: 'X', tile: appTiles.twitter },
  gallery: { title: 'Photos', tile: appTiles.gallery },
  settings: { title: 'Settings', tile: appTiles.settings },
  calender: { title: 'Calendar', tile: appTiles.calender },
  calculator: { title: 'Calculator', tile: appTiles.calculator },
};