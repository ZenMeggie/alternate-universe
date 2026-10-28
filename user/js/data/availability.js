// Fungsi murni: karakter & tanggal yang bisa dipilih diturunkan dari data yang diinput admin.

export const dayOf = (ts) => (String(ts || '').match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
export const timeOf = (ts) => (String(ts || '').match(/T(\d{2}:\d{2})/) || [])[1] || '';

// [koleksi, field waktu]
const SOURCES = [
  ['messages', 'timestamp'],
  ['notes', 'updatedAt'],
  ['photos', 'timestamp'],
  ['posts', 'timestamp'],
  ['narrations', 'timestamp'],
];

/** Hanya karakter yang dicentang "Bisa dipilih di ponsel" di admin. */
export function playableOf(characters) {
  return (characters || [])
    .filter((c) => c.playable)
    .map((c) => ({
      ...c,
      avatar: c.avatar || c.photoUrl || '',
      tagline: c.tagline || c.role || c.about || '',
      username: c.username || c.id,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Semua tanggal cerita yang punya data, urut naik (YYYY-MM-DD). */
export function availableDates(data) {
  const set = new Set();
  for (const [name, key] of SOURCES) for (const r of data[name] || []) {
    const d = dayOf(r[key]);
    if (d) set.add(d);
  }
  return [...set].sort();
}

/** Semua item milik satu karakter: { app, ts, ref }, urut waktu. */
export function collectItems(data, charId) {
  const chatIds = new Set((data.chats || []).filter((c) => (c.memberIds || []).includes(charId)).map((c) => c.id));
  const items = [];
  for (const m of data.messages || []) if (chatIds.has(m.chatId)) items.push({ app: 'whatsapp', ts: m.timestamp, ref: m });
  for (const n of data.notes || []) if (n.characterId === charId) items.push({ app: 'notes', ts: n.updatedAt, ref: n });
  for (const p of data.photos || []) if (p.characterId === charId) items.push({ app: 'gallery', ts: p.timestamp, ref: p });
  for (const p of data.posts || []) if (p.characterId === charId) items.push({ app: 'twitter', ts: p.timestamp, ref: p });
  return items.filter((i) => dayOf(i.ts)).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

export const itemsOnDay = (items, day) => items.filter((i) => dayOf(i.ts) === day);

export function countByApp(items) {
  const c = { notes: 0, whatsapp: 0, gallery: 0, twitter: 0 };
  for (const i of items) c[i.app] = (c[i.app] || 0) + 1;
  return c;
}
