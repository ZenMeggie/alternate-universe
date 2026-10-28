import { db, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "./firebase.js";
import { ui, notify, escapeHtml } from "./utils.js";
import { state, cache, currentStory, currentChapter } from "./state.js";
import { refLabel } from "./store.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { initRichEditor, addFormatBar } from "./richtext.js";
import { $ } from "./utils.js";

const blocksCol = (story, chapter) => collection(db, "stories", story.id, "chapters", chapter.id, "blocks");
const blockRef = (story, chapter, id) => doc(db, "stories", story.id, "chapters", chapter.id, "blocks", id);

/* ---------- tambah blok ---------- */
$("add-block-btn").addEventListener("click", async () => {
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter) return;
  const type = $("new-block-type").value;
  const nextOrder = state.blocks.reduce((m, b) => Math.max(m, Number(b.order || 0)), 0) + 1;
  const baseId = `block-${String(nextOrder).padStart(3, "0")}-${type}`;
  let id = baseId, suffix = 2;
  while (state.blocks.some(block => block.id === id)) id = `${baseId}-${suffix++}`;
  const block = { type, order: nextOrder, text: "", alignment: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (type === "image") Object.assign(block, { src: "", alt: "" });
  if (type === "dialogue") Object.assign(block, { character: "" });
  if (type === "chat") Object.assign(block, { characterId: "", text: "", alignment: "", messageId: "" });
  if (type === "call") Object.assign(block, { character: "", callType: "calling", callText: "Calling..." });
  try {
    await setDoc(blockRef(story, chapter, id), block);
    await loadBlocks(); notify("Blok ditambahkan.");
    document.querySelector(`[data-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) { notify(`Gagal menambah blok: ${error.message}`); }
});

export async function loadBlocks() {
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter) return;
  const snap = await getDocs(query(blocksCol(story, chapter), orderBy("order", "asc")));
  state.blocks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderBlocks();
}

/* ---------- render ---------- */
const CALL_TYPES = [
  ["calling", "Calling..."],
  ["video", "Video calling..."],
  ["incoming", "Incoming call..."],
  ["missed", "Missed call"],
  ["ended", "Call ended"],
];

function blockFields(b) {
  const textField = `<div class="wide"><span class="lbl">Teks / isi</span><textarea data-field="text" rows="${b.type === "paragraph" ? 8 : 3}">${escapeHtml(b.text || "")}</textarea></div>`;
  const alignment = `<label>Alignment<select data-field="alignment"><option value="" ${!b.alignment ? "selected" : ""}>Ikuti default bab</option>${["left","center","right","justify"].map(a => `<option ${b.alignment === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>`;
  const order = `<label>Urutan<input data-field="order" type="number" min="0" step="1" value="${Number(b.order || 0)}"></label>`;
  if (b.type === "image") return `${order}<label>Alt text<input data-field="alt" value="${escapeHtml(b.alt || "")}"></label><label class="wide">URL gambar<input data-field="src" type="url" value="${escapeHtml(b.src || "")}" placeholder="URL akan terisi setelah upload"></label><label class="wide">Upload gambar<input data-upload-image type="file" accept="image/*"></label>${b.src ? `<div class="wide"><img class="image-preview" src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt || "")}"></div>` : ""}`;
  if (b.type === "dialogue") return `<label>Karakter<input data-field="character" value="${escapeHtml(b.character || "")}" placeholder="Eve"></label>${alignment}${textField}${order}`;
  if (b.type === "chat") {
    const characterOptions = state.characters.map(c => `<option value="${escapeHtml(c.id)}" ${b.characterId === c.id ? "selected" : ""}>${escapeHtml(c.name || c.username || c.id)}</option>`).join("");
    const msgs = (cache.messages || []).filter(m => !m.type || m.type === "text").sort((a, c) => String(a.timestamp).localeCompare(String(c.timestamp)));
    const messageOptions = msgs.map(m => `<option value="${escapeHtml(m.id)}" ${b.messageId === m.id ? "selected" : ""}>${escapeHtml(refLabel("messages", m))}</option>`).join("");
    return `<label>Pengirim<select data-field="characterId" required><option value="">Pilih karakter…</option>${characterOptions}</select></label>${alignment}<label class="wide">Isi bubble chat<textarea data-field="text" rows="2" placeholder="Tulis satu pesan untuk bubble ini…">${escapeHtml(b.text || (b.messages?.[0]?.text || ""))}</textarea></label><label class="wide">Pesan WhatsApp terkait (opsional)<select data-field="messageId"><option value="">— tidak ada —</option>${messageOptions}</select></label>${order}<p class="muted wide">Satu blok = satu bubble. Pilih pesan WhatsApp jika bubble ini harus membuka chat aslinya.</p>`;
  }
  if (b.type === "call") {
    const names = state.characters.map(c => String(c.name || c.username || c.id).split(" ")[0]);
    const cur = b.character || "";
    const nameOpts = [...new Set([...(cur && !names.includes(cur) ? [cur] : []), ...names])]
      .map(n => `<option value="${escapeHtml(n)}" ${n === cur ? "selected" : ""}>${escapeHtml(n)}</option>`).join("");
    const typeKey = b.callType || CALL_TYPES.find(([, l]) => String(b.callText || "").endsWith(l))?.[0] || (b.callText ? "custom" : "calling");
    const typeOpts = CALL_TYPES.map(([v, l]) => `<option value="${v}" ${v === typeKey ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")
      + (typeKey === "custom" ? `<option value="custom" selected>Teks lama: ${escapeHtml(b.callText)}</option>` : "");
    return `<label>Karakter<select data-field="character"><option value="">— pilih karakter —</option>${nameOpts}</select></label><label>Teks panggilan<select data-field="callType">${typeOpts}</select></label>${alignment}${order}`;
  }
  return `${alignment}${textField}${order}`;
}

export function renderBlocks() {
  if (!state.blocks.length) { ui.blockList.innerHTML = '<div class="empty-note">Belum ada blok konten. Tambahkan narasi, dialog, chat, atau gambar.</div>'; return; }
  ui.blockList.innerHTML = state.blocks.map(b => `
    <article class="block-card" data-block-id="${escapeHtml(b.id)}">
      <div class="block-top"><span class="block-label">${escapeHtml(b.type)} · #${Number(b.order || 0)} · ID block/${escapeHtml(b.id)}</span><div class="block-actions"><button class="button secondary" data-move="-1" type="button">↑</button><button class="button secondary" data-move="1" type="button">↓</button><button class="button primary" data-save-block type="button">Simpan blok</button><button class="button danger" data-delete-block type="button">Hapus</button></div></div>
      <div class="block-fields">${blockFields(b)}</div>
    </article>`).join("");
  ui.blockList.querySelectorAll("[data-save-block]").forEach(btn => btn.addEventListener("click", () => saveBlock(btn.closest("[data-block-id]"))));
  ui.blockList.querySelectorAll("[data-delete-block]").forEach(btn => btn.addEventListener("click", () => removeBlock(btn.closest("[data-block-id]"))));
  ui.blockList.querySelectorAll("[data-move]").forEach(btn => btn.addEventListener("click", () => moveBlock(btn.closest("[data-block-id]"), Number(btn.dataset.move))));
  ui.blockList.querySelectorAll("[data-upload-image]").forEach(input => input.addEventListener("change", () => uploadImage(input.closest("[data-block-id]"), input.files?.[0])));
  ui.blockList.querySelectorAll('textarea[data-field="text"]').forEach(ta => {
    const id = ta.closest("[data-block-id]")?.dataset.blockId;
    if (state.blocks.find(x => x.id === id)?.type === "paragraph") initRichEditor(ta);
    else addFormatBar(ta, false);
  });
}

/* ---------- simpan / hapus / pindah / upload ---------- */
async function saveBlock(card) {
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter || !card) return;
  const block = state.blocks.find(b => b.id === card.dataset.blockId); if (!block) return;
  const data = { type: block.type, updatedAt: serverTimestamp() };
  card.querySelectorAll(".rt-editor").forEach(ed => ed._sync && ed._sync());
  card.querySelectorAll("[data-field]").forEach(field => {
    const key = field.dataset.field;
    if (key === "order") data.order = Number(field.value || 0);
    else data[key] = field.value.trim();
  });
  if (block.type === "call") {
    if (data.callType === "custom") data.callText = block.callText || "";
    else {
      const label = CALL_TYPES.find(([v]) => v === data.callType)?.[1] || "Calling...";
      data.callText = `${data.character || ""} ${label}`.trim();
    }
  }
  if (block.type === "chat" && data.messageId) {
    const m = (cache.messages || []).find(x => x.id === data.messageId);
    if (m) { data.characterId = m.senderId || ""; data.text = m.text || ""; data.chatId = m.chatId; }
  }
  try {
    await updateDoc(blockRef(story, chapter, block.id), data);
    await loadBlocks(); notify("Blok disimpan.");
  } catch (error) { notify(`Gagal menyimpan blok: ${error.message}`); }
}

async function removeBlock(card) {
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter || !card) return;
  if (!confirm("Hapus blok ini?")) return;
  try {
    await deleteDoc(blockRef(story, chapter, card.dataset.blockId));
    await loadBlocks(); notify("Blok dihapus.");
  } catch (error) { notify(`Gagal menghapus blok: ${error.message}`); }
}

async function moveBlock(card, direction) {
  const blocks = state.blocks;
  const index = blocks.findIndex(b => b.id === card?.dataset.blockId);
  const other = blocks[index + direction];
  if (index < 0 || !other) return;
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter) return;
  try {
    // Jika dua blok kebetulan punya nomor urut sama, geser agar tukar tempat tetap berefek.
    let a = Number(blocks[index].order || 0), b = Number(other.order || 0);
    if (a === b) b = a + direction;
    const batch = writeBatch(db);
    batch.update(blockRef(story, chapter, blocks[index].id), { order: b, updatedAt: serverTimestamp() });
    batch.update(blockRef(story, chapter, other.id), { order: a, updatedAt: serverTimestamp() });
    await batch.commit(); await loadBlocks();
  } catch (error) { notify(`Gagal mengubah urutan: ${error.message}`); }
}

async function uploadImage(card, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { notify("File harus berupa gambar."); return; }
  if (file.size > 10 * 1024 * 1024) { notify("Ukuran gambar maksimal 10 MB."); return; }
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter || !card) return;
  const block = state.blocks.find(b => b.id === card.dataset.blockId); if (!block) return;
  try {
    notify("Mengunggah gambar…");
    const { url, publicId } = await uploadToCloudinary(file, `story-media/${story.id}/${chapter.id}`);
    await updateDoc(blockRef(story, chapter, block.id), {
      src: url, cloudinaryPublicId: publicId, alt: block.alt || file.name, updatedAt: serverTimestamp()
    });
    await loadBlocks(); notify("Gambar diunggah dan URL disimpan.");
  } catch (error) { notify(`Upload gagal: ${error.message}`); }
}
