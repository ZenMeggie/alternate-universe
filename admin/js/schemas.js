// Skema editor "Data ponsel". Mau tambah/ubah field? Cukup edit file ini.
import { charName, accountOf, refLabel } from "./store.js";
import { stamp, clip } from "./utils.js";

const acctLabel = (charId, accId) => { const a = accountOf(charId, accId); return a ? `@${a.handle}` : charName(charId); };

export const SCHEMAS = {
  messages: {
    label: "Pesan WhatsApp", hint: "Pilih percakapan dan lihat preview chat seperti WhatsApp. Klik bubble untuk mengedit; gunakan “Tambah beberapa pesan” untuk menempel percakapan sekaligus.",
    sort: "timestamp", title: r => `${charName(r.senderId)} · ${({ text: "teks", image: "foto", sticker: "stiker", missed_call: "tak terjawab", call: "panggilan" })[r.type || "text"]}`,
    sub: r => `${stamp(r.timestamp)} · ${clip(r.text || (r.type === "sticker" ? "[stiker]" : r.type === "image" ? "[foto]" : ""), 50)}`,
    fields: [
      { key: "chatId", label: "Chat", type: "ref", ref: "chats", required: true, sticky: true },
      { key: "senderId", label: "Pengirim", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "type", label: "Jenis pesan", type: "select", options: [["text", "Teks"], ["image", "Foto"], ["sticker", "Stiker"], ["missed_call", "Panggilan tak terjawab"], ["call", "Panggilan terjawab"]], default: "text" },
      { key: "timestamp", label: "Waktu cerita", type: "datetime", required: true, sticky: true },
      { key: "image", label: "Foto", type: "image", folder: "wa-media", wide: true, required: true, showIf: { type: "image" } },
      { key: "text", label: "Teks / caption", type: "textarea", wide: true, showIf: { type: ["text", "image", "sticker"] } },
      { key: "stickerId", label: "Stiker", type: "ref", ref: "stickers", showIf: { type: "sticker" }, required: true },
      { key: "callKind", label: "Jenis panggilan", type: "select", options: [["voice", "Suara"], ["video", "Video"]], default: "voice", showIf: { type: ["missed_call", "call"] } },
      { key: "duration", label: "Durasi (mm:ss)", type: "text", placeholder: "05:12", showIf: { type: "call" } },
      { key: "narrationId", label: "Narasi (ikon ⓘ)", type: "ref", ref: "narrations" },
    ],
  },
  chats: {
    label: "Chat & grup", hint: "Chat pribadi: pilih 2 anggota. Grup: centang “Grup” dan isi nama. Chat hanya muncul di ponsel anggotanya.",
    title: r => refLabel("chats", r), sub: r => (r.isGroup ? "Grup · " : "Pribadi · ") + (r.memberIds || []).map(charName).join(", "),
    fields: [
      { key: "isGroup", label: "Grup", type: "bool" },
      { key: "name", label: "Nama grup", type: "text", showIf: { isGroup: true } },
      { key: "memberIds", label: "Anggota", type: "refmulti", ref: "characters", wide: true, required: true },
      { key: "description", label: "Deskripsi grup", type: "textarea", wide: true, showIf: { isGroup: true } },
      { key: "photoUrl", label: "Foto grup", type: "image", folder: "chat-photos", showIf: { isGroup: true } },
    ],
  },
  stickers: {
    label: "Stiker", hint: "Unggah gambar stiker (PNG/WEBP transparan paling bagus), lalu pilih saat membuat pesan.",
    title: r => r.label || r.id, sub: () => "",
    fields: [
      { key: "label", label: "Nama stiker", type: "text", required: true },
      { key: "imageUrl", label: "Gambar stiker", type: "image", folder: "stickers", required: true, wide: true },
    ],
  },
  narrations: {
    label: "Narasi (ⓘ)", hint: "Narasi bisa dikaitkan ke pesan (menampilkan cuplikan chat di dalamnya), ke bab cerita, dan ke event timeline.",
    sort: "timestamp", title: r => `${charName(r.characterId)}`, sub: r => `${stamp(r.timestamp)} · ${clip(r.text, 60)}`,
    fields: [
      { key: "characterId", label: "Karakter (sudut pandang)", type: "ref", ref: "characters", required: true },
      { key: "timestamp", label: "Waktu cerita", type: "datetime", required: true },
      { key: "text", label: "Teks narasi", type: "textarea", wide: true, required: true },
      { key: "messageId", label: "Pesan WhatsApp terkait", type: "ref", ref: "messages" },
      { key: "chapterId", label: "Bab cerita lengkap", type: "ref", ref: "chapters" },
      { key: "eventId", label: "Event ID timeline (opsional)", type: "text", placeholder: "ev-museum" },
    ],
  },
  notes: {
    label: "Catatan", hint: "Catatan pribadi karakter; muncul di aplikasi Notes sesuai tanggal cerita.",
    sort: "updatedAt", title: r => r.title || "(tanpa judul)", sub: r => `${charName(r.characterId)} · ${stamp(r.updatedAt)}`,
    fields: [
      { key: "characterId", label: "Pemilik", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "folder", label: "Folder (opsional)", type: "text" },
      { key: "updatedAt", label: "Waktu cerita", type: "datetime", required: true, sticky: true },
      { key: "content", label: "Isi catatan", type: "textarea", wide: true, rows: 7 },
      { key: "narrationId", label: "Narasi (ikon ⓘ)", type: "ref", ref: "narrations" },
      { key: "eventId", label: "Event ID timeline (opsional)", type: "text" },
    ],
  },
  photos: {
    label: "Foto galeri", hint: "Tempat dipilih dari daftar Tempat, atau klik “+ Tempat dari peta” untuk menandai lokasi baru langsung di peta.",
    sort: "timestamp", title: r => r.caption || r.activity || "(foto)", sub: r => `${charName(r.characterId)} · ${stamp(r.timestamp)} · ${r.locationName || ""}`,
    fields: [
      { key: "characterId", label: "Pemilik galeri", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "photographerId", label: "Pengambil foto", type: "ref", ref: "characters", sticky: true },
      { key: "image", label: "Foto", type: "image", folder: "gallery", required: true, wide: true },
      { key: "caption", label: "Caption", type: "text" },
      { key: "alt", label: "Alt text", type: "text" },
      { key: "timestamp", label: "Waktu cerita", type: "datetime", required: true, sticky: true },
      { key: "activity", label: "Aktivitas", type: "text" },
      { key: "place", label: "Lokasi pengambilan / kejadian", type: "place", wide: true, required: true },
      { key: "people", label: "Orang di foto", type: "refmulti", ref: "characters", wide: true },
      { key: "context", label: "Konteks", type: "textarea", wide: true },
      { key: "narrationId", label: "Narasi (cerita di balik foto)", type: "ref", ref: "narrations" },
      { key: "chapterId", label: "Bab cerita lengkap", type: "ref", ref: "chapters" },
      { key: "eventId", label: "Event ID timeline (opsional)", type: "text" },
    ],
  },
  places: {
    label: "Tempat (peta)", hint: "Daftar tempat yang bisa dipakai ulang oleh foto. Pilih lokasi lewat peta.",
    title: r => r.name || "(tempat)", sub: r => (r.latitude != null ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}` : "belum ada koordinat"),
    fields: [
      { key: "name", label: "Nama tempat", type: "text", required: true },
      { key: "address", label: "Alamat / keterangan", type: "text" },
      { key: "latlng", label: "Koordinat", type: "latlng", wide: true, required: true },
    ],
  },
  posts: {
    label: "Postingan X", hint: "Jenis: tweet biasa, repost (retweet), quote (qrt), atau reply. Pilih akun X milik karakter; akun private menyembunyikan postingannya dari karakter lain. Foto bisa lebih dari satu (maks 4 ditampilkan).",
    sort: "timestamp", title: r => `@${accountOf(r.characterId, r.accountId)?.handle || charName(r.characterId)} · ${r.kind || "tweet"}`, sub: r => `${stamp(r.timestamp)} · ${clip(r.text, 60)}`,
    fields: [
      { key: "characterId", label: "Karakter", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "accountId", label: "Akun X", type: "account", dep: "characterId", required: true, sticky: true },
      { key: "kind", label: "Jenis", type: "select", options: [["tweet", "Tweet"], ["retweet", "Repost (retweet)"], ["quote", "Quote (qrt)"], ["reply", "Reply"]], default: "tweet" },
      { key: "timestamp", label: "Waktu cerita", type: "datetime", required: true, sticky: true },
      { key: "refPostId", label: "Postingan yang di-repost / dikutip", type: "ref", ref: "posts", showIf: { kind: ["retweet", "quote"] }, required: true },
      { key: "replyToId", label: "Membalas postingan", type: "ref", ref: "posts", showIf: { kind: "reply" }, required: true },
      { key: "text", label: "Teks", type: "textarea", wide: true, showIf: { kind: ["tweet", "quote", "reply"] } },
      { key: "images", label: "Foto", type: "images", folder: "x-media", wide: true, showIf: { kind: ["tweet", "quote", "reply"] } },
      { key: "likes", label: "Likes", type: "number", default: 0 },
      { key: "reposts", label: "Repost (tambahan)", type: "number", default: 0 },
      { key: "narrationId", label: "Narasi (ikon ⓘ)", type: "ref", ref: "narrations" },
      { key: "eventId", label: "Event ID timeline (opsional)", type: "text" },
    ],
  },
  xdms: {
    label: "Chat X (DM)", hint: "Satu dokumen = satu pesan DM antar dua akun X. Percakapan dikelompokkan otomatis berdasarkan pasangan akun.",
    sort: "timestamp",
    title: r => `${acctLabel(r.senderCharacterId, r.senderAccountId)} → ${acctLabel(r.receiverCharacterId, r.receiverAccountId)}`,
    sub: r => `${stamp(r.timestamp)} · ${clip(r.text || (r.images?.length ? "[foto]" : ""), 50)}`,
    fields: [
      { key: "senderCharacterId", label: "Karakter pengirim", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "senderAccountId", label: "Akun pengirim", type: "account", dep: "senderCharacterId", required: true, sticky: true },
      { key: "receiverCharacterId", label: "Karakter penerima", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "receiverAccountId", label: "Akun penerima", type: "account", dep: "receiverCharacterId", required: true, sticky: true },
      { key: "timestamp", label: "Waktu cerita", type: "datetime", required: true, sticky: true },
      { key: "text", label: "Teks", type: "textarea", wide: true },
      { key: "images", label: "Foto", type: "images", folder: "x-dm", wide: true },
      { key: "narrationId", label: "Narasi (ikon ⓘ)", type: "ref", ref: "narrations" },
    ],
  },
  follows: {
    label: "Follow (X)", hint: "Siapa mengikuti siapa, dengan waktu cerita. Branda hanya menampilkan postingan akun yang sudah diikuti pada saat postingan itu dibuat. Kosongkan “Berhenti follow” jika masih mengikuti. Akun yang belum punya data follow sama sekali memakai aturan Branda lama (homeMode).",
    sort: "since", title: r => `${acctLabel(r.followerCharacterId, r.followerAccountId)} → ${acctLabel(r.targetCharacterId, r.targetAccountId)}`,
    sub: r => `sejak ${stamp(r.since)}${r.until ? ` · berhenti ${stamp(r.until)}` : ""}`,
    fields: [
      { key: "followerCharacterId", label: "Karakter yang follow", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "followerAccountId", label: "Akun yang follow", type: "account", dep: "followerCharacterId", required: true, sticky: true },
      { key: "targetCharacterId", label: "Karakter yang diikuti", type: "ref", ref: "characters", required: true },
      { key: "targetAccountId", label: "Akun yang diikuti", type: "account", dep: "targetCharacterId", required: true },
      { key: "since", label: "Mulai follow (waktu cerita)", type: "datetime", required: true, sticky: true },
      { key: "until", label: "Berhenti follow (opsional)", type: "datetime" },
    ],
  },
  timeline: {
    label: "Timeline cerita", hint: "Tanggal, judul part, dan lokasi timeline mengikuti data Bab. Event pada hari tersebut tetap dapat diedit di sini.",
    sort: "date",
    title: r => `${r.label || r.date || "Hari"} · ${r.title || ""}`,
    sub: r => `${r.date || "Belum ada tanggal"} · ${r.location || "Lokasi belum diatur"} · ${(r.events || []).length} event`,
    fields: [
      { key: "events", label: "Event timeline", type: "events", wide: true, default: [] },
    ],
  },
  settings: {
    label: "Pengaturan cerita", hint: "Metadata global situs. Dokumen memakai ID tetap “story” agar website selalu membaca pengaturan yang sama.",
    title: r => r.title || "Metadata cerita", sub: r => r.subtitle || "Judul dan subtitle situs",
    fields: [
      { key: "title", label: "Judul situs", type: "text", required: true },
      { key: "subtitle", label: "Subtitle", type: "textarea", wide: true },
    ],
  },
  music: {
    label: "Musik karakter", hint: "Unggah lagu untuk koleksi karakter. Lagu di Stories dikelola terpisah lewat blok musik pada bab/part.",
    sort: "title", title: r => r.title || "(tanpa judul)", sub: r => `${charName(r.characterId)} · ${r.artist || "Artis tidak diisi"} · ${r.status === "draft" ? "Draft" : "Terbit"}`,
    fields: [
      { key: "characterId", label: "Karakter pemilik", type: "ref", ref: "characters", required: true, sticky: true },
      { key: "title", label: "Judul lagu", type: "text", required: true },
      { key: "artist", label: "Artis", type: "text" },
      { key: "audioUrl", label: "File audio", type: "audio", folder: "character-music", required: true, wide: true },
      { key: "coverUrl", label: "Cover", type: "image", folder: "music-covers", wide: true },
      { key: "status", label: "Status", type: "select", options: [["published", "Terbit"], ["draft", "Draft"]], default: "published" },
    ],
  },
};

export const SCHEMA_ORDER = ["messages", "chats", "stickers", "narrations", "notes", "photos", "places", "posts", "xdms", "follows", "timeline", "music", "settings"];