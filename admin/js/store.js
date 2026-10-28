// Helper data bersama: label referensi + loader koleksi Firestore (dengan cache).
import { db, collection, collectionGroup, getDocs } from "./firebase.js";
import { state, cache } from "./state.js";
import { stamp, clip } from "./utils.js";

export const charName = id => state.characters.find(c => c.id === id)?.name || id || "—";

export const accountOf = (charId, accId) => {
  const c = state.characters.find(x => x.id === charId);
  const list = c?.twitterAccounts || [];
  return list.find(a => a.id === accId) || list[0] || null;
};

// Followers/following = angka dasar di akun + jumlah dari koleksi "follows" yang aktif pada waktu `at`.
// `at` kosong = sekarang. Pakai "9999-12-31T00:00:00+07:00" untuk hitung semua follow yang belum berhenti.
export function displayCounts(charId, acc, at = null) {
  const t = at ? new Date(at).getTime() : Date.now();
  const active = f => new Date(f.since).getTime() <= t && (!f.until || new Date(f.until).getTime() > t);
  const list = (cache.follows || []).filter(active);
  let followers = 0, following = 0;
  if (charId && acc?.id) {
    followers = list.filter(f => f.targetCharacterId === charId && accountOf(f.targetCharacterId, f.targetAccountId)?.id === acc.id).length;
    following = list.filter(f => f.followerCharacterId === charId && accountOf(f.followerCharacterId, f.followerAccountId)?.id === acc.id).length;
  }
  return {
    followers: Number(acc?.followers || 0) + followers,
    following: Number(acc?.following || 0) + following,
    counted: { followers, following }
  };
}

export function refLabel(name, r) {
  switch (name) {
    case "characters": return r.name || r.id;
    case "chats": return r.name || (r.memberIds || []).map(charName).join(" & ") || r.id;
    case "stickers": return r.label || r.id;
    case "places": return r.name || r.id;
    case "stories": return r.title || r.id;
    case "chapters": return `${state.stories.find(s => s.id === r.storyId)?.title || r.storyId} — ${r.part || ""} ${r.title || ""}`;
    case "narrations": return `${charName(r.characterId)}: ${clip(r.text)}`;
    case "messages": {
            const label = r.type === "sticker" ? "[stiker]" : r.type === "image" ? "[foto]" : r.type === "call" ? "[panggilan]" : r.type === "missed_call" ? "[tak terjawab]" : clip(r.text, 30);
      return `${stamp(r.timestamp)} ${charName(r.senderId)}: ${label}`;
    }
    case "posts": { const a = accountOf(r.characterId, r.accountId); return `@${a?.handle || charName(r.characterId)} [${r.kind || "tweet"}] ${clip(r.text, 30)}`; }
    default: return r.id;
  }
}

export async function loadCol(name, force = false) {
  if (cache[name] && !force) return cache[name];
  let list;
  if (name === "chapters") {
    if (!state.stories.length) { const s = await getDocs(collection(db, "stories")); state.stories = s.docs.map(d => ({ id: d.id, ...d.data() })); }
    const snap = await getDocs(collectionGroup(db, "chapters"));
    list = snap.docs.map(d => ({ ...d.data(), id: d.id, storyId: d.ref.parent.parent.id }));
  } else {
    const snap = await getDocs(collection(db, name));
    list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }
  if (name === "characters") { list.sort((a, b) => String(a.name).localeCompare(String(b.name))); state.characters = list; }
  cache[name] = list;
  return list;
}