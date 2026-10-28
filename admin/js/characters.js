import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, orderBy, serverTimestamp } from "./firebase.js";
import { $, notify, setHidden, slugId, escapeHtml } from "./utils.js";
import { state, cache } from "./state.js";
import { showPanel } from "./panels.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { renderBlocks } from "./blocks.js";
import { loadCol, displayCounts } from "./store.js";

/* ---------- daftar karakter ---------- */
export async function loadCharacters() {
  const snap = await getDocs(query(collection(db, "characters"), orderBy("name", "asc")));
  state.characters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.characters = state.characters;
  try { await loadCol("follows", true); } catch { /* koleksi follows belum ada / tidak bisa dibaca */ }
  renderCharacterList();
  if (state.blocks.length) renderBlocks();
}

function renderCharacterList() {
  const root = $("character-list");
  if (!state.characters.length) {
    root.innerHTML = '<div class="empty-note">Belum ada karakter. Klik “+ Karakter”.</div>';
    return;
  }
  root.innerHTML = state.characters.map(c => `<button type="button" class="character-item ${c.id === state.selectedCharacterId ? "active" : ""}" data-character-id="${escapeHtml(c.id)}">
    ${c.photoUrl ? `<img src="${escapeHtml(c.photoUrl)}" alt="" class="character-avatar">` : '<span class="character-avatar placeholder-avatar">✦</span>'}
    <span class="character-item-text"><strong>${escapeHtml(c.name || "Tanpa nama")}</strong><small>${escapeHtml(c.id)} · ${(c.twitterAccounts || []).length} akun X${c.playable ? " · playable" : ""}${c.hideInCast ? " · disembunyikan" : ""}</small></span>
  </button>`).join("");
  root.querySelectorAll("[data-character-id]").forEach(el => el.addEventListener("click", () => editCharacter(el.dataset.characterId)));
}

/* ---------- akun X per karakter ---------- */
function countsNote(a) {
  const d = displayCounts(state.selectedCharacterId, a, "9999-12-31T00:00:00+07:00");
  return `Tampil di profil: ${d.followers} followers (${d.counted.followers} dari data Follow) · ${d.following} following (${d.counted.following} dari data Follow)`;
}

function renderXAccounts() {
  const root = $("x-accounts");
  const list = state.xAccounts;
  if (!list.length) { root.innerHTML = '<div class="empty-note">Belum ada akun X. Klik “+ Akun X”.</div>'; return; }
  root.innerHTML = list.map((a, i) => `<div class="x-acct" data-i="${i}">
    <div class="x-acct-top"><strong>${escapeHtml(a.handle ? "@" + a.handle : "Akun baru")}${a.private ? " 🔒" : ""}<small class="muted"> · ID akun ${escapeHtml(a.id || slugId(a.handle) || "dibuat dari handle")}</small></strong><button type="button" class="button danger small" data-x-remove>Hapus akun</button></div>
    <div class="form-grid">
      <label>Handle<input data-xf="handle" value="${escapeHtml(a.handle || "")}" placeholder="eve_ (tanpa @)"></label>
      <label>Nama tampilan<input data-xf="displayName" value="${escapeHtml(a.displayName || "")}"></label>
      <label class="span-2">Bio<textarea data-xf="bio" rows="2">${escapeHtml(a.bio || "")}</textarea></label>
      <label>Followers dasar (di luar data Follow)<input data-xf="followers" type="number" min="0" value="${Number(a.followers || 0)}"></label>
      <label>Following dasar (di luar data Follow)<input data-xf="following" type="number" min="0" value="${Number(a.following || 0)}"></label>
      <p class="muted span-2">${escapeHtml(countsNote(a))}</p>
      <label>Bergabung<input data-xf="joined" value="${escapeHtml(a.joined || "")}" placeholder="March 2022"></label>
      <label class="check"><input data-xf="private" type="checkbox" ${a.private ? "checked" : ""}> Akun private (terkunci)</label>
      <label>Tampil di Branda<select data-xf="homeMode">${[["show", "Tampil"], ["random", "Acak (sebagian)"], ["hide", "Sembunyi"]].map(([v, l]) => `<option value="${v}" ${(a.homeMode || "show") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Banner — warna A<input data-xf="bannerFrom" type="color" value="${escapeHtml(a.bannerFrom || "#316342")}"></label>
      <label>Banner — warna B<input data-xf="bannerTo" type="color" value="${escapeHtml(a.bannerTo || "#8fb89a")}"></label>
      <label class="span-2">Foto profil akun<input data-xfile type="file" accept="image/*"></label>
      ${a._preview || a.avatarUrl ? `<div class="span-2"><img class="character-photo-preview" src="${escapeHtml(a._preview || a.avatarUrl)}" alt=""></div>` : ""}
    </div></div>`).join("");
}

$("x-accounts").addEventListener("input", event => {
  const el = event.target; const row = el.closest("[data-i]"); if (!row || !el.dataset.xf) return;
  const a = state.xAccounts[Number(row.dataset.i)];
  const k = el.dataset.xf;
  a[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value || 0) : el.value;
  if (k === "handle") a.handle = a.handle.replace(/^@/, "").replace(/\s+/g, "");
  if (k === "private") renderXAccounts();
});
$("x-accounts").addEventListener("change", event => {
  const el = event.target; const row = el.closest("[data-i]"); if (!row || !el.hasAttribute("data-xfile")) return;
  const file = el.files?.[0]; if (!file) return;
  if (!file.type.startsWith("image/")) { notify("File harus berupa gambar."); el.value = ""; return; }
  if (file.size > 10 * 1024 * 1024) { notify("Ukuran foto maksimal 10 MB."); el.value = ""; return; }
  const a = state.xAccounts[Number(row.dataset.i)];
  a._file = file; a._preview = URL.createObjectURL(file);
  renderXAccounts();
});
$("x-accounts").addEventListener("click", event => {
  if (!event.target.closest("[data-x-remove]")) return;
  const row = event.target.closest("[data-i]");
  if (!confirm("Hapus akun X ini? Postingan lama dengan akun ini tetap tersimpan.")) return;
  state.xAccounts.splice(Number(row.dataset.i), 1); renderXAccounts();
});
$("add-x-account-btn").addEventListener("click", () => {
  state.xAccounts.push({ id: "", handle: "", displayName: $("character-name").value.trim(), bio: "", followers: 0, following: 0, joined: "", private: false, bannerFrom: "#316342", bannerTo: "#8fb89a", avatarUrl: "", homeMode: "show" });
  renderXAccounts();
});

/* ---------- form karakter ---------- */
function resetCharacterForm() {
  state.selectedCharacterId = null;
  $("character-form").reset();
  $("character-id").disabled = false;
  $("character-accent").value = "#128c7e";
  $("character-form-title").textContent = "Karakter baru";
  $("character-photo-url").value = "";
  $("character-wallpaper-url").value = "";
  setHidden($("character-wallpaper-preview-wrap"), true);
  state.xAccounts = []; renderXAccounts();
  setHidden($("character-photo-preview-wrap"), true);
  setHidden($("delete-character-btn"), true);
  renderCharacterList();
}

function editCharacter(id) {
  const c = state.characters.find(item => item.id === id);
  if (!c) return;
  state.selectedCharacterId = id;
  $("character-form-title").textContent = `Edit karakter: ${c.name || ""}`;
  $("character-id").value = c.id; $("character-id").disabled = true;
  $("character-name").value = c.name || "";
  $("character-username").value = c.username || "";
  $("character-phone").value = c.phone || "";
  $("character-location").value = c.location || "";
  $("character-accent").value = /^#[0-9a-f]{6}$/i.test(c.accent || "") ? c.accent : "#128c7e";
  $("character-playable").checked = !!c.playable;
  const hideInCast = $("character-hide-in-cast");
  if (hideInCast) hideInCast.checked = !!c.hideInCast;
  $("character-about").value = c.about || "";
  $("character-tagline").value = c.tagline || "";
  $("character-fullname").value = c.fullName || "";
  $("character-age").value = c.age || "";
  $("character-role").value = c.role || "";
  $("character-pronouns").value = c.pronouns || "";
  $("character-bio").value = c.bio || "";
  $("character-photo-url").value = c.photoUrl || "";
  $("character-photo").value = "";
  $("character-wallpaper-url").value = c.wallpaperUrl || "";
  $("character-wallpaper").value = "";
  if (c.wallpaperUrl) {
    $("character-wallpaper-preview").src = c.wallpaperUrl;
    setHidden($("character-wallpaper-preview-wrap"), false);
  } else setHidden($("character-wallpaper-preview-wrap"), true);
  state.xAccounts = (c.twitterAccounts || []).map(a => ({ ...a }));
  renderXAccounts();
  if (c.photoUrl) {
    $("character-photo-preview").src = c.photoUrl;
    setHidden($("character-photo-preview-wrap"), false);
  } else setHidden($("character-photo-preview-wrap"), true);
  setHidden($("delete-character-btn"), false);
  renderCharacterList();
}

$("open-characters-btn").addEventListener("click", async () => {
  showPanel("characters");
  resetCharacterForm(); await loadCharacters();
});
$("back-to-stories-btn").addEventListener("click", () => showPanel("stories"));
$("new-character-btn").addEventListener("click", resetCharacterForm);

$("character-photo").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { notify("File harus berupa gambar."); event.target.value = ""; return; }
  if (file.size > 10 * 1024 * 1024) { notify("Ukuran foto maksimal 10 MB."); event.target.value = ""; return; }
  // Preview dulu; upload terjadi saat karakter disimpan.
  $("character-photo-preview").src = URL.createObjectURL(file);
  setHidden($("character-photo-preview-wrap"), false);
});
$("character-wallpaper").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { notify("File harus berupa gambar."); event.target.value = ""; return; }
  if (file.size > 10 * 1024 * 1024) { notify("Ukuran gambar maksimal 10 MB."); event.target.value = ""; return; }
  $("character-wallpaper-preview").src = URL.createObjectURL(file);
  setHidden($("character-wallpaper-preview-wrap"), false);
});
$("character-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("character-name").value.trim();
  if (!name) return;
  try {
    // Validasi & normalisasi akun X (ID unik per karakter, handle wajib)
    const used = new Set();
    const accounts = [];
    for (const [i, a] of state.xAccounts.entries()) {
      const handle = String(a.handle || "").replace(/^@/, "").trim();
      if (!handle) { notify(`Akun X #${i + 1}: handle wajib diisi.`); return; }
      let id = a.id || slugId(handle) || `acct-${i + 1}`;
      while (used.has(id)) id = `${id}-${i + 1}`;
      used.add(id);
      let avatarUrl = a.avatarUrl || "";
      if (a._file) avatarUrl = (await uploadToCloudinary(a._file, `x-avatars/${slugId($("character-id").value || name)}`)).url;
      accounts.push({
        id, handle, displayName: (a.displayName || name).trim(), bio: a.bio || "", followers: Number(a.followers || 0),
        following: Number(a.following || 0), joined: a.joined || "", private: !!a.private,
        bannerFrom: a.bannerFrom || "#316342", bannerTo: a.bannerTo || "#8fb89a", avatarUrl,
        homeMode: ["show", "random", "hide"].includes(a.homeMode) ? a.homeMode : "show"
      });
    }
    const payload = {
      name,
      username: $("character-username").value.trim().replace(/^@/, ""),
      fullName: $("character-fullname").value.trim(),
      age: $("character-age").value.trim(),
      role: $("character-role").value.trim(),
      pronouns: $("character-pronouns").value.trim(),
      bio: $("character-bio").value.trim(),
      phone: $("character-phone").value.trim(),
      location: $("character-location").value.trim(),
      about: $("character-about").value.trim(),
      tagline: $("character-tagline").value.trim(),
      accent: $("character-accent").value,
      playable: $("character-playable").checked,
      hideInCast: !!$("character-hide-in-cast")?.checked,
      twitterAccounts: accounts,
      photoUrl: $("character-photo-url").value.trim(),
      wallpaperUrl: $("character-wallpaper-url").value.trim(),
      updatedAt: serverTimestamp()
    };
    let id = state.selectedCharacterId;
    if (!id) {
      id = slugId($("character-id").value) || slugId(name) || `char-${Date.now()}`;
      if ((await getDoc(doc(db, "characters", id))).exists()) { notify(`ID “${id}” sudah dipakai karakter lain.`); return; }
      await setDoc(doc(db, "characters", id), { ...payload, createdAt: serverTimestamp() });
    } else {
      await updateDoc(doc(db, "characters", id), payload);
    }
    const file = $("character-photo").files?.[0];
    if (file) {
      const { url: photoUrl, publicId } = await uploadToCloudinary(file, `character-photos/${id}`);
      await updateDoc(doc(db, "characters", id), { photoUrl, photoPublicId: publicId, updatedAt: serverTimestamp() });
      $("character-photo-url").value = photoUrl;
      $("character-photo").value = "";
    }
    const wp = $("character-wallpaper").files?.[0];
    if (wp) {
      const { url } = await uploadToCloudinary(wp, `wallpapers/${id}`);
      await updateDoc(doc(db, "characters", id), { wallpaperUrl: url, updatedAt: serverTimestamp() });
      $("character-wallpaper-url").value = url;
      $("character-wallpaper").value = "";
    }
    await loadCharacters(); editCharacter(id); notify("Karakter disimpan.");
  } catch (error) { notify(`Gagal menyimpan karakter: ${error.message}`); }
});

$("delete-character-btn").addEventListener("click", async () => {
  if (!state.selectedCharacterId) return;
  const character = state.characters.find(c => c.id === state.selectedCharacterId);
  if (!confirm(`Hapus karakter “${character?.name || ""}”? Bubble yang sudah menggunakannya akan tetap tersimpan, tetapi perlu dipetakan ulang.`)) return;
  try {
    await deleteDoc(doc(db, "characters", state.selectedCharacterId));
    await loadCharacters(); resetCharacterForm(); notify("Karakter dihapus.");
  } catch (error) { notify(`Gagal menghapus karakter: ${error.message}`); }
});