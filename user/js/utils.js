// Small helpers shared by every module: escaping, date/time formatting (always in Jakarta time).

const TZ = 'Asia/Jakarta';

const fmt = (locale, opts) => new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
const keyFmt = fmt('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
const time24 = fmt('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const time12 = fmt('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const dayLong = fmt('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = fmt('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayMonth = fmt('en-GB', { day: 'numeric', month: 'short' });
const monthShort = fmt('en-GB', { month: 'short' });
const weekdayLong = fmt('en-GB', { weekday: 'long' });
const dayNum = fmt('en-GB', { day: 'numeric' });
const full = fmt('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Format aman: tanggal kosong / tidak valid menghasilkan '' alih-alih RangeError. */
const safe = (formatter, date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? formatter.format(date) : '');
const noon = (key) => new Date(`${key}T12:00:00+07:00`);
const at = (ts) => new Date(ts);

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

/** 'YYYY-MM-DD' of an ISO timestamp, in story time (Jakarta). '' kalau tidak valid. */
export const dateKey = (ts) => safe(keyFmt, at(ts));
export const formatTime = (ts) => safe(time24, at(ts));
export const formatTime12 = (ts) => safe(time12, at(ts));
export const formatDayLong = (key) => safe(dayLong, noon(key)); // Saturday 14 March
export const formatDayShort = (key) => safe(dayShort, noon(key)); // Sat 14 Mar
export const formatDayMonth = (key) => safe(dayMonth, noon(key)); // 14 Mar
export const formatMonthShort = (key) => safe(monthShort, noon(key));
export const formatWeekday = (key) => safe(weekdayLong, noon(key));
export const formatDayNumber = (key) => safe(dayNum, noon(key));
export const formatFullDate = (key) => safe(full, noon(key));
export const formatStamp = (ts) => {
  const d = at(ts);
  return safe(dayMonth, d) ? `${safe(dayMonth, d)}, ${safe(time24, d)}` : ''; // 14 Mar, 05:12
};
export const formatFullStamp = (ts) => {
  const d = at(ts);
  return safe(full, d) ? `${safe(full, d)} · ${safe(time24, d)}` : '';
};

export const truncate = (text, max = 48) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Turns @mentions into styled spans (input must already be escaped). */
export const linkMentions = (escaped) => escaped.replace(/(^|\s)@(\w+)/g, '$1<span class="mention">@$2</span>');

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Letter-avatar (data URI) used when a character/group image is missing or not provided yet. */
export function initialsAvatar(name = '?') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  let hue = 0;
  for (const ch of String(name)) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 52% 46%)"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="700" fill="#fff">${esc(letters)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}