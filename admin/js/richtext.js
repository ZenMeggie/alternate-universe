// Format teks (tebal/miring/rata), pemutar musik, dan editor WYSIWYG untuk blok Narasi.
import { $, notify, escapeHtml } from "./utils.js";
import { uploadAudio, pickAudio } from "./cloudinary.js";

/* ---------- toolbar untuk textarea biasa ---------- */
function wrapSelection(ta, mark) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  const m = mark.length;
  let out, ns, ne;
  const wrapped = sel.length > m * 2 && sel.startsWith(mark) && sel.endsWith(mark) &&
    (mark !== "*" || (!sel.startsWith("**") && !sel.endsWith("**")));
  if (wrapped) {
    out = sel.slice(m, -m); ns = s; ne = s + out.length;
  } else {
    out = `${mark}${sel}${mark}`; ns = s + m; ne = s + m + sel.length;
  }
  ta.value = value.slice(0, s) + out + value.slice(e);
  ta.focus(); ta.setSelectionRange(ns, ne);
}

function setParaAlign(ta, al) {
  const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  const a = s > 0 ? v.lastIndexOf("\n\n", s - 1) : -1;
  const start = a === -1 ? 0 : a + 2;
  const b = v.indexOf("\n\n", e);
  const end = b === -1 ? v.length : b;
  const out = v.slice(start, end).split("\n\n").map(p => {
    const clean = p.replace(/^:(left|center|right|justify):[ \t]*/, "");
    return al ? `:${al}: ${clean}` : clean;
  }).join("\n\n");
  ta.value = v.slice(0, start) + out + v.slice(end);
  ta.focus(); ta.setSelectionRange(start, start + out.length);
}

function insertBlockAt(ta, s, e, block) {
  const v = ta.value;
  const before = v.slice(0, s).replace(/\n+$/, "");
  const after = v.slice(e).replace(/^\n+/, "");
  const pre = before ? before + "\n\n" : "";
  const post = after ? "\n\n" + after : "";
  ta.value = pre + block + post;
  ta.focus();
  ta.setSelectionRange(pre.length, pre.length + block.length);
}

/** Minta audio (upload file atau URL). Return { url, title } atau null. */
async function askMusic(mode) {
  let url = "", defaultTitle = "";
  if (mode === "file") {
    const file = await pickAudio();
    if (!file) return null;
    if (!file.type.startsWith("audio/")) { notify("File harus berupa audio (mp3, m4a, wav)."); return null; }
    if (file.size > 25 * 1024 * 1024) { notify("Ukuran audio maksimal 25 MB."); return null; }
    try {
      notify("Mengunggah audio…");
      url = await uploadAudio(file);
      notify("Audio diunggah.");
    } catch (error) { notify(`Upload gagal: ${error.message}`); return null; }
    defaultTitle = file.name.replace(/\.[^.]+$/, "");
  } else {
    url = (prompt("Tempel URL audio (link langsung ke file .mp3 / .m4a):") || "").trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) { notify("URL harus diawali http:// atau https://"); return null; }
  }
  const title = (prompt("Judul / artis (boleh dikosongkan):", defaultTitle) || "").replace(/[\]|\n]/g, " ").trim();
  return { url, title };
}

async function insertMusic(ta, mode) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  const info = await askMusic(mode);
  if (!info) return;
  insertBlockAt(ta, s, e, `[[music: ${info.url}${info.title ? " | " + info.title : ""}]]`);
}

export function addFormatBar(ta, withAlign = false) {
  if (ta.previousElementSibling?.classList.contains("fmt-bar")) return;
  const bar = document.createElement("div");
  bar.className = "fmt-bar";
  bar.innerHTML =
    '<button type="button" data-fmt="**" title="Tebal (Ctrl+B)"><b>B</b></button>' +
    '<button type="button" data-fmt="*" title="Miring (Ctrl+I)"><i>I</i></button>' +
    (withAlign
      ? '<span class="fmt-sep"></span>' +
        '<button type="button" data-al="left" title="Rata kiri">Kiri</button>' +
        '<button type="button" data-al="center" title="Tengah">Tengah</button>' +
        '<button type="button" data-al="right" title="Rata kanan">Kanan</button>' +
        '<button type="button" data-al="justify" title="Justify">Justify</button>' +
        '<button type="button" data-al="" title="Kembali ke default">Reset</button>' +
        '<span class="fmt-sep"></span>' +
        '<button type="button" data-music="file" title="Unggah file audio dan sisipkan pemutar di posisi kursor">🎵 Upload</button>' +
        '<button type="button" data-music="url" title="Sisipkan pemutar dari link audio">🔗 URL</button>' +
        '<span class="muted">Enter 2× = paragraf baru</span>'
      : '<span class="muted">**tebal** · *miring* · ***keduanya***</span>');
  bar.addEventListener("mousedown", e => e.preventDefault()); // jaga seleksi teks
  bar.addEventListener("click", e => {
    const f = e.target.closest("[data-fmt]");
    if (f) { wrapSelection(ta, f.dataset.fmt); return; }
    const mu = e.target.closest("[data-music]");
    if (mu) { insertMusic(ta, mu.dataset.music); return; }
    const a = e.target.closest("[data-al]");
    if (a) setParaAlign(ta, a.dataset.al);
  });
  ta.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); wrapSelection(ta, "**"); }
    if (k === "i") { e.preventDefault(); wrapSelection(ta, "*"); }
  });
  ta.insertAdjacentElement("beforebegin", bar);
}

/* ---------- editor WYSIWYG untuk blok Narasi ---------- */
const ALIGN_SET = new Set(["left", "center", "right", "justify"]);
const MUSIC_RE = /^\[\[music:\s*(https?:\/\/[^\s|\]]+)\s*(?:\|\s*([^\]]*?))?\s*\]\]$/;

function musicEditorHtml(url, title) {
  return `<div class="rt-music" contenteditable="false" data-url="${escapeHtml(url)}" data-title="${escapeHtml(title || "")}"><button type="button" class="rt-music__x" data-rm-music title="Hapus musik">×</button><div class="rt-music__head">🎵 ${escapeHtml(title || "Putar musik")}</div><audio controls preload="none" src="${escapeHtml(url)}"></audio></div>`;
}
function inlineToHtml(s) {
  return escapeHtml(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}
/** Teks tersimpan → isi editor */
function markupToEditorHtml(text) {
  const parts = String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return "<p><br></p>";
  return parts.map(p => {
    const mu = p.match(MUSIC_RE);
    if (mu) return musicEditorHtml(mu[1], mu[2] || "");
    const m = p.match(/^:(left|center|right|justify):[ \t]*/);
    const al = m ? m[1] : "";
    if (m) p = p.slice(m[0].length);
    return `<p${al ? ` style="text-align:${al}"` : ""}>${inlineToHtml(p) || "<br>"}</p>`;
  }).join("");
}
function inlineToMarkup(node) {
  let out = "";
  node.childNodes.forEach(n => {
    if (n.nodeType === 3) { out += n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === "BR") { out += "\n"; return; }
    const inner = inlineToMarkup(n);
    if (!inner.trim()) { out += inner; return; }
    const st = n.style || {};
    const bold = n.tagName === "B" || n.tagName === "STRONG" || st.fontWeight === "bold" || Number(st.fontWeight) >= 600;
    const ital = n.tagName === "I" || n.tagName === "EM" || st.fontStyle === "italic";
    out += bold && ital ? `***${inner}***` : bold ? `**${inner}**` : ital ? `*${inner}*` : inner;
  });
  return out;
}
/** Isi editor → teks tersimpan */
function editorToMarkup(ed) {
  const paras = [];
  ed.childNodes.forEach(n => {
    if (n.nodeType === 1 && n.classList.contains("rt-music")) {
      const url = n.dataset.url; if (!url) return;
      const t = (n.dataset.title || "").replace(/[\]|\n]/g, " ").trim();
      paras.push(`[[music: ${url}${t ? " | " + t : ""}]]`);
      return;
    }
    let body, al = "";
    if (n.nodeType === 3) body = n.nodeValue;
    else if (n.nodeType === 1) { body = inlineToMarkup(n); al = ALIGN_SET.has(n.style.textAlign) ? n.style.textAlign : ""; }
    else return;
    body = body.replace(/\u00a0/g, " ").replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "").trim();
    if (!body) return;
    paras.push(al ? `:${al}: ${body}` : body);
  });
  return paras.join("\n\n");
}
function selectedBlocks(ed) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  if (!ed.contains(r.commonAncestorContainer)) return [];
  return [...ed.children].filter(c => c.tagName === "P" && r.intersectsNode(c));
}
function ensureTrailingP(ed) {
  const last = ed.lastElementChild;
  if (!last || last.classList.contains("rt-music")) ed.insertAdjacentHTML("beforeend", "<p><br></p>");
}
async function insertMusicInEditor(ed, mode) {
  // simpan posisi kursor dulu, karena upload / prompt membuat fokus hilang
  const sel = window.getSelection();
  let anchor = null;
  if (sel.rangeCount && ed.contains(sel.anchorNode)) {
    anchor = sel.anchorNode;
    while (anchor && anchor.parentNode !== ed) anchor = anchor.parentNode;
  }
  const info = await askMusic(mode);
  if (!info) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = musicEditorHtml(info.url, info.title);
  const card = tmp.firstElementChild;
  if (anchor && anchor.parentNode === ed) {
    const empty = anchor.nodeType === 1 && anchor.tagName === "P" && !anchor.textContent.trim();
    anchor.after(card);
    if (empty) anchor.remove();
  } else ed.append(card);
  ensureTrailingP(ed);
  ed._sync();
}

export function initRichEditor(ta) {
  if (ta.dataset.rich) return;
  ta.dataset.rich = "1";
  const card = ta.closest("[data-block-id]");
  ta.style.display = "none"; // textarea tetap ada (data-field="text") untuk tombol Simpan blok
  const wrap = document.createElement("div");
  wrap.className = "rt-wrap";

  wrap.innerHTML =
    '<div class="fmt-bar">' +
    '<button type="button" data-cmd="bold" title="Tebal (Ctrl+B)" aria-label="Tebal"><b>B</b></button>' +
    '<button type="button" data-cmd="italic" title="Miring (Ctrl+I)" aria-label="Miring"><i>I</i></button>' +
    '<span class="fmt-sep"></span>' +
    '<button type="button" data-al="left" title="Rata kiri" aria-label="Rata kiri"><i class="fa-solid fa-align-left"></i></button>' +
    '<button type="button" data-al="center" title="Rata tengah" aria-label="Rata tengah"><i class="fa-solid fa-align-center"></i></button>' +
    '<button type="button" data-al="right" title="Rata kanan" aria-label="Rata kanan"><i class="fa-solid fa-align-right"></i></button>' +
    '<button type="button" data-al="justify" title="Rata penuh" aria-label="Justify"><i class="fa-solid fa-align-justify"></i></button>' +
    '<button type="button" data-al="" title="Reset alignment" aria-label="Reset alignment"><i class="fa-solid fa-rotate-left"></i></button>' +
    '<span class="fmt-sep"></span>' +
    '<button type="button" data-music="file" title="Unggah audio" aria-label="Unggah audio"><i class="fa-solid fa-file-audio"></i></button>' +
    '<button type="button" data-music="url" title="Audio dari URL" aria-label="Audio dari URL"><i class="fa-solid fa-link"></i></button>' +
    '</div><div class="rt-editor" contenteditable="true" spellcheck="true"></div>';
  ta.insertAdjacentElement("beforebegin", wrap);
  const ed = wrap.querySelector(".rt-editor");
  ed.innerHTML = markupToEditorHtml(ta.value);
  ensureTrailingP(ed);
  document.execCommand("defaultParagraphSeparator", false, "p");
  document.execCommand("styleWithCSS", false, false);

  const sync = () => { ta.value = editorToMarkup(ed); };
  ed._sync = sync;

  // rata teks bawaan: ikut pilihan Alignment blok, kalau kosong ikut default bab
  const alignSel = card?.querySelector('select[data-field="alignment"]');
  const applyDefault = () => { ed.style.textAlign = alignSel?.value || $("chapter-alignment").value || "left"; };
  applyDefault();
  alignSel?.addEventListener("change", applyDefault);

  ed.addEventListener("input", () => {
    if (ed.firstChild && ed.firstChild.nodeType === 3) document.execCommand("formatBlock", false, "p");
    sync();
  });
  ed.addEventListener("paste", e => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, t);
  });
  ed.addEventListener("click", e => {
    const x = e.target.closest("[data-rm-music]");
    if (!x) return;
    x.closest(".rt-music").remove();
    ensureTrailingP(ed); sync();
  });
  const bar = wrap.querySelector(".fmt-bar");
  bar.addEventListener("mousedown", e => e.preventDefault()); // jaga seleksi teks
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.music) { insertMusicInEditor(ed, b.dataset.music); return; }
    ed.focus();
    if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
    else if (b.dataset.al !== undefined) selectedBlocks(ed).forEach(p => { p.style.textAlign = b.dataset.al; });
    sync();
  });
  sync();
}
