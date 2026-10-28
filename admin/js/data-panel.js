// Editor "Data ponsel" berbasis skema (chat, pesan, stiker, narasi, catatan, foto, tempat, postingan X, DM X, follow).
import { db, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "./firebase.js";
import { $, notify, escapeHtml, slugId } from "./utils.js";
import { state, cache } from "./state.js";
import { loadCol, refLabel } from "./store.js";
import { SCHEMAS, SCHEMA_ORDER } from "./schemas.js";
import { showPanel } from "./panels.js";
import { uploadToCloudinary, uploadAudio } from "./cloudinary.js";
import { openMapPicker } from "./map-picker.js";
import "./bulk-chat.js";

let records = [];
let selectedId = null;
let draft = {};
let lastSticky = {};
let dirty = false;
let uploading = false;
let messageChatId = "";
let messagePreviewCharacterId = "";
let previewScrollChatId = "";
let messageFormOpen = false;

const DATA_NAV_GROUPS = [
  { label: "WhatsApp", keys: ["chats", "messages", "stickers"] },
  { label: "Cerita & timeline", keys: ["narrations", "notes", "photos", "places", "timeline"] },
  { label: "X", keys: ["posts", "xdms", "follows"] },
  { label: "Media & pengaturan", keys: ["music", "settings"] },
];

function setDirty(value) {
  dirty = value;
  $("data-dirty-status").classList.toggle("hidden", !dirty);
}

function confirmDiscardChanges() {
  if (uploading) {
    notify("Tunggu upload selesai sebelum berpindah.");
    return false;
  }
  return !dirty || confirm("Ada perubahan yang belum disimpan. Buang perubahan ini?");
}

export function renderDataNav() {
  const groupedKeys = new Set(DATA_NAV_GROUPS.flatMap(group => group.keys));
  const groups = [
    ...DATA_NAV_GROUPS,
    { label: "Lainnya", keys: SCHEMA_ORDER.filter(key => !groupedKeys.has(key)) },
  ].filter(group => group.keys.length);
  $("data-nav").innerHTML = groups.map(group => `<section class="data-nav-group">
    <h3>${escapeHtml(group.label)}</h3>
    ${group.keys.map(key => `<button type="button" class="button secondary small" data-open-data="${key}">${escapeHtml(SCHEMAS[key].label)}</button>`).join("")}
  </section>`).join("");
  $("data-nav").querySelectorAll("[data-open-data]").forEach(b => b.addEventListener("click", () => openData(b.dataset.openData)));
  filterDataNav();
}

function filterDataNav() {
  const query = $("data-nav-search").value.trim().toLowerCase();
  $("data-nav").querySelectorAll(".data-nav-group").forEach(group => {
    let visibleCount = 0;
    group.querySelectorAll("[data-open-data]").forEach(button => {
      const visible = !query || button.textContent.toLowerCase().includes(query);
      button.classList.toggle("hidden", !visible);
      if (visible) visibleCount++;
    });
    group.classList.toggle("hidden", visibleCount === 0);
  });
}

$("data-nav-search").addEventListener("input", filterDataNav);

document.addEventListener("click", event => {
  if (!dirty && !uploading) return;
  const target = event.target.closest("[data-select-story], #new-story-btn, #open-characters-btn, #logout-btn");
  if (!target) return;
  if (!confirmDiscardChanges()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  setDirty(false);
}, true);

async function openData(key) {
  if (key === state.dataKey && !$("data-panel").classList.contains("hidden")) return;
  if (!confirmDiscardChanges()) return;
  state.dataKey = key; selectedId = null; lastSticky = {};
  messageFormOpen = false;
  setDirty(false);
  const sc = SCHEMAS[key];
  showPanel("data");
  $("data-title").textContent = sc.label; $("data-hint").textContent = sc.hint || "";
  $("data-search").value = "";
  $("data-nav").querySelectorAll("[data-open-data]").forEach(button => button.classList.toggle("active", button.dataset.openData === key));
  try {
    const needed = new Set([key, "characters", ...sc.fields.filter(f => f.ref).map(f => f.ref)]);
    if (key === "posts") needed.add("posts");
    if (sc.fields.some(f => f.type === "place")) needed.add("places");
    await Promise.all([...needed].map(n => loadCol(n, true)));
    await loadCol("stories");
  } catch (error) { notify(`Gagal memuat data: ${error.message}`); }
  records = cache[key] || [];
  updateMessageWorkflow();
  newDraft();
  if (key === "messages" && messageChatId) {
    draft.chatId = messageChatId;
    lastSticky.chatId = messageChatId;
  }
  renderDataList(); renderDataForm();
  document.dispatchEvent(new CustomEvent("data-panel:opened", { detail: { key } }));
}

/* ---------- daftar record ---------- */
function sortedRecords() {
  const sc = SCHEMAS[state.dataKey];
  const q = $("data-search").value.trim().toLowerCase();
  let list = [...records];
  if (state.dataKey === "messages") {
    if (!messageChatId) return [];
    list = list.filter(record => record.chatId === messageChatId);
  }
  if (q) list = list.filter(r => `${sc.title(r)} ${sc.sub(r)} ${r.id}`.toLowerCase().includes(q));
  if (sc.sort) list.sort((a, b) => {
    const order = String(a[sc.sort] || "").localeCompare(String(b[sc.sort] || ""));
    return state.dataKey === "messages" ? order : -order;
  });
  else list.sort((a, b) => sc.title(a).localeCompare(sc.title(b)));
  return list;
}
function renderDataList() {
  const sc = SCHEMAS[state.dataKey];
  const list = sortedRecords();
  const isMessages = state.dataKey === "messages";
  $("data-search").classList.toggle("hidden", isMessages && !messageChatId);
  $("data-new-btn").textContent = isMessages ? "Tambah satu pesan" : "+ Baru";
  $("data-new-btn").classList.toggle("hidden", state.dataKey === "timeline" || (state.dataKey === "settings" && records.some(r => r.id === "story")) || (isMessages && !messageChatId));
  $("data-form").classList.toggle("hidden", isMessages && (!messageChatId || !messageFormOpen));
  const previousPreview = $("data-list").querySelector(".wa-preview__chat");
  const previousScrollTop = previousPreview && previewScrollChatId === messageChatId ? previousPreview.scrollTop : null;
  if (isMessages && !messageChatId) {
    $("data-list").innerHTML = (cache.chats || []).length
      ? '<div class="empty-note">Pilih percakapan di atas untuk melihat urutan chat dan mulai mengisi pesan.</div>'
      : '<div class="empty-note">Belum ada percakapan. Klik “Kelola / buat chat” untuk membuat chat terlebih dahulu.</div>';
  } else if (isMessages && !list.length) {
    $("data-list").innerHTML = '<div class="empty-note">Belum ada pesan di percakapan ini. Tambahkan satu pesan atau masukkan beberapa pesan sekaligus.</div>';
  } else if (isMessages) {
    const chat = (cache.chats || []).find(item => item.id === messageChatId);
    $("data-list").innerHTML = renderMessagePreview(list, chat);
  } else {
    $("data-list").innerHTML = list.length ? list.map(r => `<button type="button" class="record-item ${r.id === selectedId ? "active" : ""}" data-record="${escapeHtml(r.id)}"><strong>${escapeHtml(sc.title(r))}</strong><small>${escapeHtml(sc.sub(r))} · ID ${escapeHtml(r.id)}</small></button>`).join("") : '<div class="empty-note">Belum ada data. Klik “+ Baru”.</div>';
  }
  if (isMessages && messageChatId) {
    const preview = $("data-list").querySelector(".wa-preview__chat");
    if (preview) preview.scrollTop = previousScrollTop ?? preview.scrollHeight;
    previewScrollChatId = messageChatId;
  }
  $("bulk-chat-btn")?.classList.toggle("hidden", !isMessages || !messageChatId);
  $("data-list").querySelectorAll("[data-record]").forEach(b => b.addEventListener("click", () => selectRecord(b.dataset.record)));
}

function messageTime(value) {
  const raw = typeof value?.toDate === "function" ? value.toDate().toISOString() : String(value || "");
  const match = raw.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function messageDay(value) {
  const raw = typeof value?.toDate === "function" ? value.toDate().toISOString() : String(value || "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}

function renderMessagePreview(messages, chat) {
  const members = chat?.memberIds || [];
  const otherId = members.find(id => id !== messagePreviewCharacterId) || members[0];
  const contact = chat?.isGroup
    ? { name: chat.name || "Grup WhatsApp", image: chat.photoUrl || "" }
    : (cache.characters || []).find(character => character.id === otherId) || { name: otherId || "Percakapan", image: "" };
  const avatar = contact.image || contact.photoUrl;
  let lastDay = "";
  const bubbles = messages.map(message => {
    const day = messageDay(message.timestamp);
    const separator = day && day !== lastDay ? `<div class="wa-preview__day"><span>${escapeHtml(day)}</span></div>` : "";
    lastDay = day;
    const mine = message.senderId === messagePreviewCharacterId;
    const sender = (cache.characters || []).find(character => character.id === message.senderId);
    const type = message.type || (message.stickerId ? "sticker" : "text");
    const photo = message.image || message.imageUrl || "";
    const sticker = (cache.stickers || []).find(item => item.id === message.stickerId);
    const isCall = type === "call" || type === "missed_call";
    const content = isCall
      ? `<div class="wa-preview__call"><span aria-hidden="true">${type === "missed_call" ? "↙" : "↗"}</span><span><strong>${type === "missed_call" ? "Panggilan tak terjawab" : "Panggilan"} ${message.callKind === "video" ? "video" : "suara"}</strong><small>${escapeHtml(message.duration || (type === "missed_call" ? "Tidak dijawab" : "Panggilan WhatsApp"))}</small></span></div>`
      : type === "image" || photo
        ? `${photo ? `<img class="wa-preview__image" src="${escapeHtml(photo)}" alt="Foto dalam pesan">` : '<span class="wa-preview__missing">Foto belum diunggah</span>'}${message.text ? `<span class="wa-preview__text">${escapeHtml(message.text)}</span>` : ""}`
        : type === "sticker"
          ? `${sticker?.imageUrl ? `<img class="wa-preview__sticker" src="${escapeHtml(sticker.imageUrl)}" alt="${escapeHtml(sticker.label || "Stiker")}">` : `<span class="wa-preview__missing">${escapeHtml(sticker?.label || "Stiker")}</span>`}${message.text ? `<span class="wa-preview__text">${escapeHtml(message.text)}</span>` : ""}`
          : `<span class="wa-preview__text">${escapeHtml(message.text || "Pesan kosong")}</span>`;
    const groupSender = chat?.isGroup && !mine ? `<strong class="wa-preview__sender">${escapeHtml(sender?.name || message.senderId || "Pengirim")}</strong>` : "";
    return `${separator}<button type="button" class="wa-preview__message ${mine ? "is-outgoing" : "is-incoming"} ${message.id === selectedId ? "is-selected" : ""}" data-record="${escapeHtml(message.id)}" aria-label="Edit pesan dari ${escapeHtml(sender?.name || message.senderId || "pengirim")}">
      <span class="wa-preview__bubble">${groupSender}${content}<span class="wa-preview__meta">${message.narrationId ? '<span aria-label="Memiliki narasi">ⓘ</span>' : ""}<time>${escapeHtml(messageTime(message.timestamp))}</time>${mine ? '<span class="wa-preview__ticks" aria-label="Terkirim">✓✓</span>' : ""}</span></span>
    </button>`;
  }).join("");
  const participantNames = members.map(id => (cache.characters || []).find(character => character.id === id)?.name || id).join(", ");
  const initial = String(contact.name || "?").trim().charAt(0).toUpperCase();
  return `<section class="wa-preview" aria-label="Preview percakapan WhatsApp">
    <header class="wa-preview__header">
      ${avatar ? `<img class="wa-preview__avatar" src="${escapeHtml(avatar)}" alt="">` : `<span class="wa-preview__avatar wa-preview__avatar--fallback">${escapeHtml(initial)}</span>`}
      <span class="wa-preview__contact"><strong>${escapeHtml(contact.name || "Percakapan")}</strong><small>${escapeHtml(chat?.isGroup ? participantNames : "tap di sini untuk info kontak")}</small></span>
      <span class="wa-preview__icons" aria-hidden="true">▣　☎</span>
    </header>
    <div class="wa-preview__chat" aria-live="polite">${bubbles || '<p class="wa-preview__empty">Belum ada pesan di percakapan ini.<br>Mulai dengan tombol “Tambah satu pesan” atau “Tambah beberapa pesan”.</p>'}</div>
    <div class="wa-preview__composer" aria-hidden="true"><span>＋</span><i></i><span>▣</span><span>●</span></div>
    <p class="wa-preview__hint">Klik bubble untuk mengedit pesan.</p>
  </section>`;
}
$("data-search").addEventListener("input", renderDataList);
$("data-back-btn").addEventListener("click", () => {
  if (confirmDiscardChanges()) { setDirty(false); showPanel("stories"); }
});
$("data-new-btn").addEventListener("click", () => {
  if (!confirmDiscardChanges()) return;
  selectedId = null; setDirty(false); newDraft();
  if (state.dataKey === "messages" && messageChatId) {
    draft.chatId = messageChatId;
    messageFormOpen = true;
  }
  renderDataList(); renderDataForm();
});

/* ---------- draft ---------- */
function emptyOf(f) {
  return f.type === "bool" ? false : (f.type === "refmulti" || f.type === "images" || f.type === "events") ? [] : f.type === "number" ? (f.default ?? 0) : (f.default ?? "");
}
function newDraft() {
  draft = {};
  for (const f of SCHEMAS[state.dataKey].fields) {
    if (f.type === "place") Object.assign(draft, { placeId: "", locationName: "", latitude: "", longitude: "" });
    else if (f.type === "latlng") Object.assign(draft, { latitude: "", longitude: "" });
    else if (f.type === "events") draft[f.key] = [];
    else draft[f.key] = f.sticky && lastSticky[f.key] !== undefined ? lastSticky[f.key] : emptyOf(f);
  }
}
function selectRecord(id, force = false) {
  if ((!force && id === selectedId) || (!force && !confirmDiscardChanges())) return;
  const r = records.find(x => x.id === id); if (!r) return;
  if (state.dataKey === "messages" && r.chatId !== messageChatId) {
    messageChatId = r.chatId || "";
    updateMessageWorkflow();
  }
  if (state.dataKey === "messages") messageFormOpen = true;
  selectedId = id; draft = {};
  setDirty(false);
  for (const f of SCHEMAS[state.dataKey].fields) {
    if (f.type === "place") Object.assign(draft, { placeId: r.placeId || "", locationName: r.locationName || "", latitude: r.latitude ?? "", longitude: r.longitude ?? "" });
    else if (f.type === "latlng") Object.assign(draft, { latitude: r.latitude ?? "", longitude: r.longitude ?? "" });
    else if (f.type === "events") draft[f.key] = Array.isArray(r[f.key]) ? r[f.key].map(event => ({ ...event })) : [];
    else draft[f.key] = r[f.key] ?? emptyOf(f);
  }
  renderDataList(); renderDataForm();
}

/* ---------- render form ---------- */
const visible = f => !f.showIf || Object.entries(f.showIf).every(([k, v]) => [].concat(v).includes(draft[k]));

function refOptions(f) {
  const list = [...(cache[f.ref] || [])];
  if (f.ref === "messages") list.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  else list.sort((a, b) => refLabel(f.ref, a).localeCompare(refLabel(f.ref, b)));
  return list.map(r => [r.id, refLabel(f.ref, r)]);
}
function accountOptions(f) {
  const c = state.characters.find(x => x.id === draft[f.dep]);
  return (c?.twitterAccounts || []).map(a => [a.id, `@${a.handle}${a.private ? " 🔒" : ""}`]);
}
const optionsHtml = (opts, value, blank = "— pilih —") => (blank ? `<option value="">${blank}</option>` : "") + opts.map(([v, l]) => `<option value="${escapeHtml(v)}" ${String(value) === String(v) ? "selected" : ""}>${escapeHtml(l)}</option>`).join("");

function updateMessageWorkflow() {
  const active = state.dataKey === "messages";
  $("message-workflow").classList.toggle("hidden", !active);
  $("data-form").classList.toggle("hidden", active && !messageChatId);
  if (!active) return;

  const chats = [...(cache.chats || [])].sort((a, b) => refLabel("chats", a).localeCompare(refLabel("chats", b)));
  if (!chats.some(chat => chat.id === messageChatId)) messageChatId = "";
  const activeChat = chats.find(chat => chat.id === messageChatId);
  const members = activeChat?.memberIds || [];
  if (!members.includes(messagePreviewCharacterId)) {
    messagePreviewCharacterId = members.find(id => (cache.characters || []).find(character => character.id === id)?.playable) || members[0] || "";
  }
  $("message-chat-filter").innerHTML = optionsHtml(chats.map(chat => [chat.id, refLabel("chats", chat)]), messageChatId, "— pilih percakapan —");
  $("message-chat-filter").value = messageChatId;
  const participantOptions = members.map(id => {
    const character = (cache.characters || []).find(item => item.id === id);
    return [id, character?.name || id];
  });
  $("message-preview-character").innerHTML = optionsHtml(participantOptions, messagePreviewCharacterId, "");
  $("message-preview-character").disabled = participantOptions.length < 2;
  const chat = chats.find(item => item.id === messageChatId);
  $("message-chat-summary").textContent = chat
    ? `${(chat.memberIds || []).map(id => (cache.characters || []).find(character => character.id === id)?.name || id).join(" · ")} · ${(cache.messages || []).filter(message => message.chatId === chat.id).length} pesan. Klik pesan untuk mengedit, atau tambah pesan baru.`
    : chats.length
      ? "Pilih percakapan untuk melihat pesannya. Setiap percakapan ditampilkan terpisah agar urutannya mudah diikuti."
      : "Belum ada chat. Buat chat dan pilih anggotanya terlebih dahulu.";
}

$("message-chat-filter").addEventListener("change", () => {
  const nextChatId = $("message-chat-filter").value;
  if (!confirmDiscardChanges()) {
    $("message-chat-filter").value = messageChatId;
    return;
  }
  messageChatId = nextChatId;
  selectedId = null;
  messageFormOpen = false;
  previewScrollChatId = "";
  setDirty(false);
  $("data-search").value = "";
  if (messageChatId) {
    lastSticky.chatId = messageChatId;
    lastSticky.senderId = "";
  } else {
    delete lastSticky.chatId;
    delete lastSticky.senderId;
  }
  newDraft();
  if (messageChatId) draft.chatId = messageChatId;
  updateMessageWorkflow();
  renderDataList();
  renderDataForm();
});

$("message-preview-character").addEventListener("change", () => {
  messagePreviewCharacterId = $("message-preview-character").value;
  renderDataList();
});

$("message-chat-create").addEventListener("click", () => $("data-nav").querySelector('[data-open-data="chats"]')?.click());

document.addEventListener("data-panel:messages-updated", () => {
  if (state.dataKey !== "messages") return;
  messageFormOpen = false;
  records = cache.messages || [];
  updateMessageWorkflow();
  renderDataList();
});

function fieldHtml(f) {
  const v = draft[f.key];
  const cls = `${f.wide ? "span-2" : ""}${visible(f) ? "" : " hidden"}`;
  const label = `${escapeHtml(f.label)}${f.required ? " *" : ""}`;
  const wrap = inner => `<label class="${cls}" data-field="${f.key}">${label}${inner}</label>`;
  switch (f.type) {
    case "text": return wrap(`<input data-k="${f.key}" value="${escapeHtml(v ?? "")}" placeholder="${escapeHtml(f.placeholder || "")}">`);
    case "textarea": return wrap(`<textarea data-k="${f.key}" rows="${f.rows || 3}">${escapeHtml(v ?? "")}</textarea>`);
    case "events": return `<div class="${cls}" data-field="${f.key}"><div class="lbl">${label}</div><div class="timeline-events">${(v || []).map((event, i) => `<div class="timeline-event" data-event-index="${i}">
      <div class="timeline-event__top"><strong>Event ${i + 1}</strong><button type="button" class="button danger small" data-act="remove-event" data-index="${i}">Hapus event</button></div>
      <label>ID event<input data-event-field="id" data-index="${i}" value="${escapeHtml(event.id || "")}" placeholder="ev-museum"></label>
      <label>Waktu<input data-event-field="time" data-index="${i}" value="${escapeHtml(event.time || "")}" placeholder="16:42"></label>
      <label class="span-2">Judul<input data-event-field="title" data-index="${i}" value="${escapeHtml(event.title || "")}"></label>
      <label class="span-2">Ringkasan<textarea data-event-field="summary" data-index="${i}" rows="3">${escapeHtml(event.summary || "")}</textarea></label>
    </div>`).join("")}</div><button type="button" class="button secondary small" data-act="add-event">+ Event</button></div>`;
    case "number": return wrap(`<input data-k="${f.key}" type="number" step="1" value="${escapeHtml(v ?? 0)}">`);
    case "datetime": return wrap(`<input data-k="${f.key}" type="datetime-local" step="1" value="${escapeHtml(String(v || "").slice(0, 19))}">`);
    case "select": return wrap(`<select data-k="${f.key}">${optionsHtml(f.options, v, "")}</select>`);
    case "ref": return wrap(`<select data-k="${f.key}">${optionsHtml(refOptions(f), v)}</select>`);
    case "account": return wrap(`<select data-k="${f.key}">${optionsHtml(accountOptions(f), v, draft[f.dep] ? "— pilih akun —" : "— pilih karakter dulu —")}</select>`);
    case "bool": return `<label class="check ${cls}" data-field="${f.key}"><input data-k="${f.key}" type="checkbox" ${v ? "checked" : ""}> ${escapeHtml(f.label)}</label>`;
    case "refmulti": {
      const sel = new Set(v || []);
      return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><div class="multi" data-multi="${f.key}">${refOptions(f).map(([id, l]) => `<label class="check"><input type="checkbox" value="${escapeHtml(id)}" ${sel.has(id) ? "checked" : ""}> ${escapeHtml(l)}</label>`).join("") || '<span class="muted">Belum ada data.</span>'}</div></div>`;
    }
    case "image": return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><input data-upload="${f.key}" type="file" accept="image/*">${v ? `<div class="thumbs"><div class="thumb"><img src="${escapeHtml(v)}" alt=""><button type="button" data-act="rm-image" data-key="${f.key}" aria-label="Hapus">×</button></div></div>` : ""}</div>`;
    case "audio": return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><input data-k="${f.key}" type="url" value="${escapeHtml(v ?? "")}" placeholder="URL audio akan terisi setelah upload"><input data-upload-audio="${f.key}" type="file" accept="audio/*">${v ? `<audio controls preload="metadata" src="${escapeHtml(v)}"></audio>` : ""}</div>`;
    case "images": return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><input data-upload-multi="${f.key}" type="file" accept="image/*" multiple><div class="thumbs">${(v || []).map((u, i) => `<div class="thumb"><img src="${escapeHtml(u)}" alt=""><button type="button" data-act="rm-image" data-key="${f.key}" data-i="${i}" aria-label="Hapus">×</button></div>`).join("")}</div></div>`;
    case "place": return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><div class="field-row"><select data-place>${optionsHtml((cache.places || []).map(p => [p.id, p.name]).sort((a, b) => a[1].localeCompare(b[1])), draft.placeId)}</select><button type="button" class="button secondary small" data-act="new-place">+ Tempat dari peta</button></div><p class="muted">${draft.latitude !== "" ? `${escapeHtml(draft.locationName || "")} · ${Number(draft.latitude).toFixed(5)}, ${Number(draft.longitude).toFixed(5)}` : "Belum ada lokasi dipilih."}</p></div>`;
    case "latlng": return `<div class="${cls}" data-field="${f.key}"><span class="lbl">${label}</span><div class="field-row"><input data-k="latitude" type="number" step="any" placeholder="Latitude" value="${escapeHtml(draft.latitude ?? "")}"><input data-k="longitude" type="number" step="any" placeholder="Longitude" value="${escapeHtml(draft.longitude ?? "")}"><button type="button" class="button secondary small" data-act="pick-latlng">Pilih di peta</button></div></div>`;
    default: return "";
  }
}
function renderDataForm() {
  const sc = SCHEMAS[state.dataKey];
  if (state.dataKey === "timeline" && !selectedId) {
    $("data-form").innerHTML = '<h3 class="span-2">Timeline mengikuti Bab/Part</h3><p class="span-2 muted">Buat atau edit part dari editor cerita. Tanggal dan lokasi part akan membentuk timeline serta menjadi acuan cuaca ponsel.</p>';
    return;
  }
  const identity = selectedId
    ? `${state.dataKey}/${selectedId}`
    : `${state.dataKey}/${state.dataKey === "settings" ? "story" : `ID otomatis kategori ${sc.idPrefix || state.dataKey + "-"}`}`;
  const canDelete = selectedId && !["settings", "timeline"].includes(state.dataKey);
  const timelineHint = state.dataKey === "timeline"
    ? '<p class="span-2 muted">Hari timeline dibuat dari Bab/Part. Ubah tanggal atau lokasi di editor bab; bagian ini khusus untuk mengelola event.</p>'
    : "";
  $("data-form").innerHTML = `<h3 class="span-2">${selectedId ? "Edit" : "Baru"}: ${escapeHtml(sc.label)}</h3><p class="span-2 record-id">Kategori / ID dokumen: <code>${escapeHtml(identity)}</code>${selectedId ? " · ID tetap agar referensi data tidak rusak." : " · ID ramah-admin akan dibuat otomatis saat disimpan."}</p>${timelineHint}${sc.fields.map(fieldHtml).join("")}
    <div class="form-actions span-2"><button class="button primary" type="submit">${selectedId ? "Simpan perubahan" : "Simpan"}</button>${canDelete ? '<button class="button danger" type="button" data-act="delete">Hapus</button>' : ""}</div>`;
}
function applyConditionals() {
  for (const f of SCHEMAS[state.dataKey].fields) $("data-form").querySelector(`[data-field="${f.key}"]`)?.classList.toggle("hidden", !visible(f));
}

/* ---------- event form ---------- */
function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? "" : Number(el.value);
  if (el.type === "datetime-local") return el.value ? `${el.value}${el.value.length === 16 ? ":00" : ""}+07:00` : "";
  return el.value;
}
function applyPlace(p) {
  if (!p) { Object.assign(draft, { placeId: "", locationName: "", latitude: "", longitude: "" }); return; }
  Object.assign(draft, { placeId: p.id, locationName: p.name || "", latitude: p.latitude ?? "", longitude: p.longitude ?? "" });
}

const ID_PREFIXES = {
  messages: "msg", chats: "chat", stickers: "sticker", narrations: "narration",
  notes: "note", photos: "photo", places: "place", posts: "post", music: "music",
  xdms: "dm", follows: "follow", timeline: "day",
};

function recordIdSeed(key, data) {
  switch (key) {
    case "messages": return `${data.timestamp}-${data.chatId}-${data.senderId}`;
    case "chats": return data.name || (data.memberIds || []).join("-");
    case "stickers": return data.label;
    case "narrations": return `${data.characterId}-${data.timestamp}`;
    case "notes": return `${data.characterId}-${data.title}`;
    case "photos": return `${data.characterId}-${data.timestamp}`;
    case "places": return data.name;
    case "posts": return `${data.characterId}-${data.timestamp}`;
    case "music": return `${data.characterId}-${data.title}`;
    case "xdms": return `${data.senderCharacterId}-${data.receiverCharacterId}-${data.timestamp}`;
    case "follows": return `${data.followerCharacterId}-${data.targetCharacterId}-${data.since}`;
    case "timeline": return data.date;
    default: return "";
  }
}

async function uniqueRecordId(key, data) {
  if (key === "settings") return "story";
  const prefix = ID_PREFIXES[key] || slugId(key);
  const seed = SCHEMAS[key].idSeed ? SCHEMAS[key].idSeed(data) : recordIdSeed(key, data);
  const base = `${prefix}-${slugId(seed) || "baru"}`;
  let candidate = base;
  for (let suffix = 2; (await getDoc(doc(db, key, candidate))).exists(); suffix++) {
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

$("data-form").addEventListener("input", event => {
  const el = event.target;
  if (el.type === "file") return;
  setDirty(true);
  if (el.dataset.eventField) {
    const item = draft.events[Number(el.dataset.index)];
    if (item) item[el.dataset.eventField] = el.value;
    return;
  }
  const multi = el.closest("[data-multi]");
  if (multi) { draft[multi.dataset.multi] = [...multi.querySelectorAll("input:checked")].map(i => i.value); return; }
  if (el.hasAttribute("data-place")) { applyPlace(cache.places.find(p => p.id === el.value)); renderDataForm(); return; }
  const k = el.dataset.k; if (!k) return;
  draft[k] = readInput(el);
  const sc = SCHEMAS[state.dataKey];
  if (sc.fields.some(f => f.showIf && k in f.showIf)) applyConditionals();
  if (sc.fields.some(f => f.dep === k)) { for (const f of sc.fields.filter(x => x.dep === k)) draft[f.key] = ""; renderDataForm(); }
});

$("data-form").addEventListener("change", async event => {
  const el = event.target;
  if (el.type !== "file" || !el.files?.length) return;
  const sc = SCHEMAS[state.dataKey];
  const key = el.dataset.upload || el.dataset.uploadMulti;
  const audioKey = el.dataset.uploadAudio;
  if (audioKey) {
    const f = sc.fields.find(x => x.key === audioKey); if (!f) return;
    const file = el.files[0];
    if (!file.type.startsWith("audio/")) { notify("File harus berupa audio."); return; }
    if (file.size > 25 * 1024 * 1024) { notify("Ukuran audio maksimal 25 MB."); return; }
    const hadChanges = dirty;
    uploading = true;
    setDirty(true);
    try {
      notify("Mengunggah audio…");
      draft[audioKey] = await uploadAudio(file, f.folder || "music");
      setDirty(true); renderDataForm(); notify("Audio diunggah. Jangan lupa simpan.");
    } catch (error) { setDirty(hadChanges); notify(`Upload audio gagal: ${error.message}`); el.value = ""; }
    finally { uploading = false; }
    return;
  }
  const f = sc.fields.find(x => x.key === key); if (!f) return;
  const files = [...el.files];
  for (const file of files) {
    if (!file.type.startsWith("image/")) { notify("File harus berupa gambar."); return; }
    if (file.size > 10 * 1024 * 1024) { notify("Ukuran gambar maksimal 10 MB."); return; }
  }
  const hadChanges = dirty;
  uploading = true;
  setDirty(true);
  try {
    notify("Mengunggah gambar…");
    const urls = [];
    for (const file of files) urls.push((await uploadToCloudinary(file, `${f.folder || "misc"}`)).url);
    if (el.dataset.upload) draft[key] = urls[0]; else draft[key] = [...(draft[key] || []), ...urls];
    setDirty(true); renderDataForm(); notify("Gambar diunggah. Jangan lupa simpan.");
  } catch (error) { setDirty(hadChanges); notify(`Upload gagal: ${error.message}`); el.value = ""; }
  finally { uploading = false; }
});

$("data-form").addEventListener("click", async event => {
  const btn = event.target.closest("[data-act]"); if (!btn) return;
  const act = btn.dataset.act;
  if (act === "add-event") {
    const existing = new Set((cache.timeline || []).flatMap(day => (day.events || []).map(item => item.id)));
    (draft.events || []).forEach(item => existing.add(item.id));
    const baseId = `ev-${slugId(draft.date || "day")}`;
    let id = "", suffix = 1;
    do { id = `${baseId}-${suffix++}`; } while (existing.has(id));
    draft.events.push({ id, time: "", title: "", summary: "" });
    setDirty(true);
    renderDataForm();
  } else if (act === "remove-event") {
    draft.events.splice(Number(btn.dataset.index), 1);
    setDirty(true);
    renderDataForm();
  } else if (act === "rm-image") {
    if (btn.dataset.i !== undefined) draft[btn.dataset.key].splice(Number(btn.dataset.i), 1); else draft[btn.dataset.key] = "";
    setDirty(true);
    renderDataForm();
  } else if (act === "pick-latlng") {
    const r = await openMapPicker({ lat: draft.latitude, lng: draft.longitude, name: draft.name || "" });
    if (!r) return;
    draft.latitude = r.lat; draft.longitude = r.lng; if (!draft.name && r.name) draft.name = r.name;
    setDirty(true);
    renderDataForm();
  } else if (act === "new-place") {
    const r = await openMapPicker({ lat: draft.latitude, lng: draft.longitude, name: draft.locationName });
    if (!r) return;
    if (!r.name) { notify("Isi nama tempat dulu."); return; }
    try {
      const placeData = { name: r.name, address: "", latitude: r.lat, longitude: r.lng };
      const placeId = await uniqueRecordId("places", placeData);
      await setDoc(doc(db, "places", placeId), { ...placeData, _created: serverTimestamp(), _updated: serverTimestamp() });
      const place = { id: placeId, ...placeData };
      (cache.places ||= []).push(place);
      applyPlace(place); setDirty(true); renderDataForm(); notify("Tempat baru disimpan.");
    } catch (error) { notify(`Gagal menyimpan tempat: ${error.message}`); }
  } else if (act === "delete") {
    if (!selectedId || !confirm("Hapus data ini?")) return;
    try {
      await deleteDoc(doc(db, state.dataKey, selectedId));
      records = await loadCol(state.dataKey, true); selectedId = null; setDirty(false); newDraft();
      if (state.dataKey === "messages") updateMessageWorkflow();
      renderDataList(); renderDataForm(); notify("Data dihapus.");
    } catch (error) { notify(`Gagal menghapus: ${error.message}`); }
  }
});

$("data-form").addEventListener("submit", async event => {
  event.preventDefault();
  const dataKey = state.dataKey;
  const sc = SCHEMAS[dataKey];
  const payload = {};
  for (const f of sc.fields) {
    const show = visible(f);
    if (f.type === "place") {
      if (f.required && show && (draft.latitude === "" || draft.latitude == null)) { notify(`${f.label} wajib diisi.`); return; }
      Object.assign(payload, { placeId: draft.placeId || "", locationName: draft.locationName || "", latitude: draft.latitude === "" ? null : Number(draft.latitude), longitude: draft.longitude === "" ? null : Number(draft.longitude) });
      continue;
    }
    if (f.type === "latlng") {
      if (f.required && (draft.latitude === "" || draft.longitude === "")) { notify("Koordinat wajib diisi (pilih di peta)."); return; }
      Object.assign(payload, { latitude: Number(draft.latitude), longitude: Number(draft.longitude) });
      continue;
    }
    const v = draft[f.key];
    const empty = v === "" || v == null || (Array.isArray(v) && !v.length);
    if (f.required && show && empty) { notify(`${f.label} wajib diisi.`); return; }
    payload[f.key] = show ? (typeof v === "string" ? v.trim() : v) : emptyOf(f);
  }
  if (dataKey === "timeline") {
    const eventIds = payload.events.map(event => event?.id);
    const existingEventIds = (cache.timeline || [])
      .filter(day => day.id !== selectedId)
      .flatMap(day => (day.events || []).map(event => event?.id));
    if (payload.events.some(event => !event?.title?.trim())
      || eventIds.some(id => typeof id !== "string" || !/^ev-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
      || new Set(eventIds).size !== eventIds.length
      || eventIds.some(id => existingEventIds.includes(id))) {
      notify("Setiap event harus memiliki judul dan ID unik berawalan “ev-” (contoh: ev-museum).");
      return;
    }
  }
  if (dataKey === "chats") {
    if (!payload.isGroup && payload.memberIds.length !== 2) { notify("Chat pribadi harus punya tepat 2 anggota."); return; }
    if (payload.isGroup && payload.memberIds.length < 2) { notify("Grup minimal 2 anggota."); return; }
  }
  if (dataKey === "messages" && payload.type === "text" && !payload.text) { notify("Teks pesan wajib diisi."); return; }
  if (dataKey === "messages" && payload.chatId && !payload.senderId) { notify("Pengirim wajib diisi."); return; }
  if (dataKey === "messages") {
    const chat = (cache.chats || []).find(c => c.id === payload.chatId);
    if (chat && !(chat.memberIds || []).includes(payload.senderId)) { notify("Pengirim bukan anggota chat ini."); return; }
  }
  if (dataKey === "xdms") {
    if (payload.senderCharacterId === payload.receiverCharacterId && payload.senderAccountId === payload.receiverAccountId) { notify("Pengirim dan penerima tidak boleh akun yang sama."); return; }
    if (!payload.text && !(payload.images || []).length) { notify("Isi teks atau foto."); return; }
  }
  if (payload.chapterId) payload.storyId = (cache.chapters || []).find(c => c.id === payload.chapterId)?.storyId || "";
  else if ("chapterId" in payload) payload.storyId = "";
  if (dataKey === "posts") {
    const ref = payload.refPostId || payload.replyToId;
    if (ref && ref === selectedId) { notify("Postingan tidak boleh merujuk dirinya sendiri."); return; }
  }
  try {
    let id = selectedId;
    if (id) await updateDoc(doc(db, dataKey, id), { ...payload, _updated: serverTimestamp() });
    else {
      id = await uniqueRecordId(dataKey, payload);
      const data = { ...payload, _created: serverTimestamp(), _updated: serverTimestamp() };
      if (dataKey === "settings") {
        const existing = await getDoc(doc(db, dataKey, id));
        if (existing.exists()) await updateDoc(doc(db, dataKey, id), { ...payload, _updated: serverTimestamp() });
        else await setDoc(doc(db, dataKey, id), data);
      } else await setDoc(doc(db, dataKey, id), data);
    }
    // Sinkronkan relasi dua arah pesan ↔ narasi
    if (dataKey === "messages" && payload.narrationId) { await updateDoc(doc(db, "narrations", payload.narrationId), { messageId: id }); delete cache.narrations; }
    if (dataKey === "narrations" && payload.messageId) { await updateDoc(doc(db, "messages", payload.messageId), { narrationId: id }); delete cache.messages; }
    records = await loadCol(dataKey, true);
    if (dataKey === "messages") updateMessageWorkflow();
    for (const f of sc.fields) if (f.sticky) lastSticky[f.key] = draft[f.key];
    setDirty(false);
    if (selectedId) { selectRecord(id, true); }
    else { selectedId = null; newDraft(); if (dataKey === "messages" && messageChatId) draft.chatId = messageChatId; renderDataList(); renderDataForm(); }
    notify(selectedId ? "Data disimpan." : "Data disimpan. Formulir siap untuk entri berikutnya.");
  } catch (error) { notify(`Gagal menyimpan: ${error.message}`); }
});

window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});