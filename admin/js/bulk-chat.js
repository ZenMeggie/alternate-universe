// Input massal pesan WhatsApp: paste banyak baris -> preview & edit -> simpan ke koleksi "messages".
// Mengikuti SCHEMAS.messages (schemas.js) dan payload form di data-panel.js. Tidak mengubah skema.
import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";
import { $, notify, escapeHtml, slugId } from "./utils.js";
import { cache } from "./state.js";
import { loadCol, refLabel, charName } from "./store.js";

const MAX_ROWS = 300;
const TZ = "+07:00"; // sama dengan readInput() di data-panel.js
const TYPES = [["text", "Teks"], ["sticker", "Stiker"], ["missed_call", "Panggilan tak terjawab"], ["call", "Panggilan terjawab"]];
const STEPS = [[60, "1 menit"], [120, "2 menit"], [300, "5 menit"], [1, "1 detik (menit sama, urut lewat detik)"]];

let modal = null;
let rows = [];
let saving = false;
let startTouched = false;

/* ---------- helper waktu (waktu "naif" WIB, tanpa konversi zona) ---------- */
const parseLocal = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : NaN;
};
const fmtLocal = ms => new Date(ms).toISOString().slice(0, 19);
const normLocal = v => (v && v.length === 16 ? `${v}:00` : v || "");

const chatById = id => (cache.chats || []).find(c => c.id === id);
const membersOf = id => chatById(id)?.memberIds || [];
const opts = (list, value, blank) => (blank ? `<option value="">${blank}</option>` : "") +
  list.map(([v, l]) => `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? "selected" : ""}>${escapeHtml(l)}</option>`).join("");

/* ---------- tombol di panel Pesan WhatsApp ---------- */
$("bulk-chat-btn").addEventListener("click", openBulk);
document.addEventListener("data-panel:opened", e => {
  $("bulk-chat-btn").classList.toggle("hidden", e.detail?.key !== "messages" || !$("message-chat-filter")?.value);
});

/* ---------- modal ---------- */
function injectStyle() {
  const s = document.createElement("style");
  s.textContent = `
.bulk-box{width:min(1000px,96vw);max-height:92vh;overflow:auto}
.bulk-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}
.bulk-list{display:flex;flex-direction:column;gap:8px;margin:12px 0}
.bulk-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;border:1px solid rgba(128,128,128,.35);border-radius:10px}
.bulk-row.bulk-left{margin-right:8%}.bulk-row.bulk-right{margin-left:8%}
.bulk-row.bulk-bad{border-color:#d33}
.bulk-n{min-width:2.2em;opacity:.6}
.bulk-main{flex:1 1 240px;min-width:0;display:flex;gap:8px}
.bulk-main input,.bulk-main select{flex:1;min-width:0}
.bulk-err{flex-basis:100%;color:#d33;font-size:.85em}.bulk-err:empty{display:none}
.bulk-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-top:12px}
.bulk-report{border:1px solid #d33;border-radius:10px;padding:10px;margin:8px 0}
.bulk-report ul{margin:6px 0 0;padding-left:18px}
.bulk-busy .bulk-list{pointer-events:none;opacity:.6}`;
  document.head.appendChild(s);
}

function buildModal() {
  injectStyle();
  modal = document.createElement("div");
  modal.id = "bulk-chat-modal"; modal.className = "modal-backdrop hidden";
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Input massal pesan WhatsApp");
  modal.innerHTML = `
<div class="modal-box bulk-box">
  <div class="section-heading"><h2>Input massal pesan WhatsApp</h2><button id="bulk-close" class="button secondary small" type="button">Tutup</button></div>
  <p class="muted">Tempel isi percakapan: satu baris untuk satu pesan. Pilih chat, pengirim awal, dan waktu; periksa preview sebelum menyimpan.</p>
  <div class="bulk-controls">
    <label>Chat<select id="bulk-chat"></select></label>
    <label>Pengirim default<select id="bulk-sender"></select></label>
    <label>Waktu mulai<input id="bulk-start" type="datetime-local" step="1"></label>
    <label>Jeda antar pesan<select id="bulk-step">${opts(STEPS, 60)}</select></label>
  </div>
  <label class="check"><input id="bulk-detect" type="checkbox" checked> Kenali pengirim dari format “Nama: pesan”</label>
  <label>Isi percakapan<textarea id="bulk-text" rows="7" placeholder="Noe: Halo, udah sampai?&#10;Eve: Udah, baru turun dari kereta&#10;Noe: Oke, hati-hati ya"></textarea><small class="muted">Nama harus sama dengan nama salah satu anggota chat. Pesan tanpa nama memakai pengirim default.</small></label>
  <div class="form-actions"><button id="bulk-build" class="button primary" type="button">Buat preview</button></div>
  <div class="bulk-head">
    <strong id="bulk-count">Belum ada preview.</strong>
    <span id="bulk-tools" class="hidden"><button id="bulk-apply-sender" class="button secondary small" type="button">Semua pengirim = default</button> <button id="bulk-retime" class="button secondary small" type="button">Hitung ulang waktu</button></span>
  </div>
  <div id="bulk-list" class="bulk-list"></div>
  <div id="bulk-report" class="bulk-report hidden"></div>
  <div class="form-actions"><button id="bulk-save" class="button primary" type="button" disabled>Simpan semua</button></div>
</div>`;
  (document.querySelector(".shell") || document.body).appendChild(modal);

  $("bulk-close").addEventListener("click", closeBulk);
  $("bulk-build").addEventListener("click", buildRows);
  $("bulk-save").addEventListener("click", saveAll);
  $("bulk-start").addEventListener("input", () => { startTouched = true; });
  $("bulk-chat").addEventListener("change", onChatChange);
  $("bulk-apply-sender").addEventListener("click", () => {
    const d = $("bulk-sender").value; if (!d) { notify("Pilih pengirim default dulu."); return; }
    rows.forEach(r => { r.sender = d; }); renderRows();
  });
  $("bulk-retime").addEventListener("click", () => {
    const start = parseLocal($("bulk-start").value); if (isNaN(start)) { notify("Isi waktu mulai dulu."); return; }
    const step = Number($("bulk-step").value) * 1000;
    rows.forEach((r, i) => { r.time = fmtLocal(start + i * step); }); renderRows();
  });

  const list = $("bulk-list");
  list.addEventListener("input", e => {
    const el = e.target, f = el.dataset.f, row = rows[Number(el.closest(".bulk-row")?.dataset.i)];
    if (!row || !["text", "duration", "time"].includes(f)) return;
    row[f] = f === "time" ? normLocal(el.value) : el.value;
    refreshStatus();
  });
  list.addEventListener("change", e => {
    const el = e.target, f = el.dataset.f, row = rows[Number(el.closest(".bulk-row")?.dataset.i)];
    if (!row || !["sender", "type", "stickerId", "callKind"].includes(f)) return;
    row[f] = el.value;
    renderRows();
  });
  list.addEventListener("click", e => {
    const del = e.target.closest("[data-del]"); if (!del) return;
    rows.splice(Number(del.closest(".bulk-row").dataset.i), 1); renderRows();
  });
}

function fillChats(selected) {
  const list = [...(cache.chats || [])].sort((a, b) => refLabel("chats", a).localeCompare(refLabel("chats", b)));
  $("bulk-chat").innerHTML = opts(list.map(c => [c.id, refLabel("chats", c)]), selected, "— pilih chat —");
}
function fillSenders(selected) {
  $("bulk-sender").innerHTML = opts(membersOf($("bulk-chat").value).map(id => [id, charName(id)]), selected, "— pilih pengirim —");
}
function suggestStart() {
  const chatId = $("bulk-chat").value, step = Number($("bulk-step").value);
  const last = (cache.messages || []).filter(m => m.chatId === chatId).map(m => String(m.timestamp || "")).sort().pop();
  const base = parseLocal(last);
  if (!isNaN(base)) return fmtLocal(base + step * 1000);
  return normLocal($("data-form")?.querySelector('[data-k="timestamp"]')?.value || "").slice(0, 19);
}
function onChatChange() {
  fillSenders("");
  const mem = membersOf($("bulk-chat").value);
  rows.forEach(r => { if (!mem.includes(r.sender)) r.sender = ""; });
  if (!startTouched) $("bulk-start").value = suggestStart();
  renderRows();
}

function openBulk() {
  if (!(cache.chats || []).length) { notify("Belum ada chat. Buat chat dulu di panel Chat & grup."); return; }
  if (!modal) buildModal();
  rows = []; startTouched = false; saving = false;
  $("bulk-text").value = ""; $("bulk-report").classList.add("hidden");
  const formChat = $("message-chat-filter")?.value || $("data-form")?.querySelector('[data-k="chatId"]')?.value;
  fillChats(chatById(formChat) ? formChat : "");
  fillSenders("");
  $("bulk-start").value = suggestStart();
  renderRows();
  modal.classList.remove("hidden");
}
function closeBulk() {
  if (saving) return;
  if (rows.length && !confirm("Tutup dan buang preview yang belum disimpan?")) return;
  rows = []; modal.classList.add("hidden");
}

/* ---------- parse -> preview ---------- */
function buildRows() {
  const chatId = $("bulk-chat").value, defSender = $("bulk-sender").value;
  if (!chatId) { notify("Pilih chat dulu."); return; }
  if (!defSender) { notify("Pilih pengirim default dulu."); return; }
  const start = parseLocal($("bulk-start").value);
  if (isNaN(start)) { notify("Isi waktu mulai dulu."); return; }
  const lines = $("bulk-text").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) { notify("Tempel pesan dulu."); return; }
  if (lines.length > MAX_ROWS) { notify(`Maksimal ${MAX_ROWS} pesan sekali input.`); return; }
  if (rows.length && !confirm("Preview saat ini akan diganti. Lanjutkan?")) return;
  const step = Number($("bulk-step").value) * 1000;
  const names = membersOf(chatId).map(id => [id, [id, charName(id), String(charName(id)).split(" ")[0]].map(s => String(s).toLowerCase())]);
  const detect = $("bulk-detect").checked;
  rows = lines.map((line, i) => {
    let sender = defSender, text = line;
    if (detect) {
      const m = /^([^:]{1,40}):\s+(.+)$/.exec(line);
      const hit = m && names.find(([, keys]) => keys.includes(m[1].trim().toLowerCase()));
      if (hit) { sender = hit[0]; text = m[2].trim(); }
    }
    return { n: i + 1, sender, type: "text", text, stickerId: "", callKind: "voice", duration: "", time: fmtLocal(start + i * step) };
  });
  $("bulk-report").classList.add("hidden");
  renderRows();
}

/* ---------- preview ---------- */
function problem(r, mem) {
  if (!r.sender) return "Pengirim wajib diisi.";
  if (!mem.includes(r.sender)) return "Pengirim bukan anggota chat ini.";
  if (isNaN(parseLocal(r.time))) return "Waktu tidak valid.";
  if (r.type === "text" && !String(r.text).trim()) return "Teks pesan wajib diisi.";
  if (r.type === "sticker" && !r.stickerId) return "Pilih stiker.";
  return "";
}

function renderRows() {
  const mem = membersOf($("bulk-chat").value);
  const senderList = mem.map(id => [id, charName(id)]);
  const stickers = (cache.stickers || []).map(s => [s.id, refLabel("stickers", s)]);
  $("bulk-list").innerHTML = rows.map((r, i) => {
    let main;
    if (r.type === "text") main = `<div class="bulk-main"><input data-f="text" value="${escapeHtml(r.text)}" placeholder="Teks pesan"></div>`;
    else if (r.type === "sticker") main = `<div class="bulk-main"><select data-f="stickerId">${opts(stickers, r.stickerId, "— pilih stiker —")}</select><input data-f="text" value="${escapeHtml(r.text)}" placeholder="Teks (opsional)"></div>`;
    else main = `<div class="bulk-main"><select data-f="callKind">${opts([["voice", "Suara"], ["video", "Video"]], r.callKind)}</select>${r.type === "call" ? `<input data-f="duration" value="${escapeHtml(r.duration)}" placeholder="Durasi 05:12">` : ""}</div>`;
    const side = mem.indexOf(r.sender) === 0 ? "bulk-left" : "bulk-right";
    return `<div class="bulk-row ${side}" data-i="${i}">
      <span class="bulk-n">#${r.n}</span>
      <select data-f="sender">${opts(senderList, r.sender, "— pilih —")}</select>
      <select data-f="type">${opts(TYPES, r.type)}</select>
      ${main}
      <input data-f="time" type="datetime-local" step="1" value="${escapeHtml(r.time)}">
      <button type="button" class="button danger small" data-del aria-label="Hapus pesan">×</button>
      <small class="bulk-err"></small>
    </div>`;
  }).join("");
  refreshStatus();
}

function refreshStatus() {
  const mem = membersOf($("bulk-chat").value);
  let bad = 0;
  rows.forEach((r, i) => {
    const p = problem(r, mem); if (p) bad++;
    const el = $("bulk-list").children[i];
    if (el) { el.classList.toggle("bulk-bad", !!p); el.querySelector(".bulk-err").textContent = p; }
  });
  $("bulk-count").textContent = rows.length ? `${rows.length} pesan akan disimpan${bad ? ` · ${bad} perlu diperbaiki` : ""}` : "Belum ada preview.";
  $("bulk-tools").classList.toggle("hidden", !rows.length);
  $("bulk-save").disabled = saving || !rows.length || bad > 0;
}

/* ---------- simpan ---------- */
// Payload meniru submit form di data-panel.js: field yang tidak relevan diisi nilai kosongnya
// (callKind default "voice"), dan narrationId dikosongkan sehingga relasi narasi tidak tersentuh.
function toPayload(chatId, r) {
  const withText = r.type === "text" || r.type === "sticker";
  return {
    chatId, senderId: r.sender, type: r.type,
    timestamp: `${r.time}${TZ}`,
    text: withText ? String(r.text).trim() : "",
    stickerId: r.type === "sticker" ? r.stickerId : "",
    callKind: r.type === "missed_call" || r.type === "call" ? r.callKind : "voice",
    duration: r.type === "call" ? String(r.duration).trim() : "",
    narrationId: "",
    _created: serverTimestamp(), _updated: serverTimestamp(),
  };
}

async function saveAll() {
  if (saving) return;
  const chatId = $("bulk-chat").value, chat = chatById(chatId);
  if (!chat) { notify("Chat tidak ditemukan."); return; }
  const mem = chat.memberIds || [];
  if (rows.some(r => problem(r, mem))) { notify("Masih ada pesan yang belum valid."); refreshStatus(); return; }
  if (!confirm(`Simpan ${rows.length} pesan ke chat “${refLabel("chats", chat)}”?`)) return;

  saving = true; modal.classList.add("bulk-busy"); refreshStatus();
  const total = rows.length, failed = []; let done = 0;
  for (let i = 0; i < total; i++) {
    $("bulk-save").textContent = `Menyimpan ${i + 1}/${total}…`;
    try {
      const row = rows[i];
      const baseId = `msg-${slugId(`${row.time}-${chatId}-${row.sender}-${row.n}`) || `entry-${row.n}`}`;
      let id = baseId, suffix = 2;
      while ((await getDoc(doc(db, "messages", id))).exists()) id = `${baseId}-${suffix++}`;
      await setDoc(doc(db, "messages", id), toPayload(chatId, row)); done++;
    }
    catch (error) { failed.push({ row: rows[i], msg: error.message }); }
  }
  saving = false; modal.classList.remove("bulk-busy"); $("bulk-save").textContent = "Simpan semua";
  rows = failed.map(f => f.row);

  if (done) {
    try {
      await loadCol("messages", true);
      document.dispatchEvent(new CustomEvent("data-panel:messages-updated"));
    } catch (error) {
      notify(`Pesan tersimpan, tetapi daftar gagal dimuat ulang: ${error.message}`);
    }
  }
  if (!failed.length) { modal.classList.add("hidden"); notify(`${done} pesan berhasil disimpan.`); return; }

  const rep = $("bulk-report");
  rep.innerHTML = `<strong>${done} berhasil, ${failed.length} gagal.</strong> Pesan yang gagal tetap ada di preview; klik “Simpan semua” untuk mencoba ulang hanya yang gagal.<ul>${failed.map(f => `<li>#${f.row.n}: ${escapeHtml(String(f.row.text || `[${f.row.type}]`).slice(0, 40))} — ${escapeHtml(f.msg)}</li>`).join("")}</ul>`;
  rep.classList.remove("hidden");
  renderRows();
  notify(`${done} berhasil, ${failed.length} gagal.`);
}