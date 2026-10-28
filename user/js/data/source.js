// SATU-SATUNYA tempat yang perlu disesuaikan dengan store.js kamu.
// Asumsi: store.getCollection(nama) mengembalikan array dokumen Firestore (sudah dimuat).
// Kalau nama fungsinya beda, ganti isi getData() saja.
import * as store from './store.js';

const NAMES = ['characters', 'chats', 'messages', 'notes', 'photos', 'posts', 'narrations'];

export function getData() {
  const out = {};
  for (const n of NAMES) out[n] = store.getCollection(n) || [];
  return out;
}
