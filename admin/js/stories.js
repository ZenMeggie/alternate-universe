import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "./firebase.js";
import { $, ui, notify, setHidden, statusLabel, slugId, escapeHtml } from "./utils.js";
import { state, cache, currentStory } from "./state.js";
import { showPanel } from "./panels.js";
import { loadChapters } from "./chapters.js";

export async function loadStories(keepSelected = true) {
  const previous = keepSelected ? state.selectedStoryId : null;
  const snap = await getDocs(query(collection(db, "stories"), orderBy("updatedAt", "desc")));
  state.stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!state.stories.length) {
    state.selectedStoryId = null; state.selectedChapterId = null;
    renderStoryList(); showPanel(state.panel); return;
  }
  state.selectedStoryId = state.stories.some(s => s.id === previous)
    ? previous
    : (state.selectedStoryId && state.stories.some(s => s.id === state.selectedStoryId) ? state.selectedStoryId : state.stories[0].id);
  renderStoryList();
  await selectStory(state.selectedStoryId, state.panel);
}

export function renderStoryList() {
  if (!state.stories.length) {
    ui.storyList.innerHTML = '<div class="empty-note">Belum ada cerita. Klik “+ Baru”.</div>'; return;
  }
  ui.storyList.innerHTML = state.stories.map(s => `
    <div class="story-item ${s.id === state.selectedStoryId ? "active" : ""}">
      <div class="item-main" data-select-story="${escapeHtml(s.id)}">
        <div class="item-title">${escapeHtml(s.title || "Tanpa judul")}</div>
        <div class="item-sub">${escapeHtml(statusLabel(s.status))} · ${escapeHtml(s.subtitle || "Tanpa subtitle")} · ID story/${escapeHtml(s.id)}</div>
      </div>
      <span class="status ${s.status === "draft" ? "draft" : ""}">${s.status === "published" ? "●" : "○"}</span>
    </div>`).join("");
  ui.storyList.querySelectorAll("[data-select-story]").forEach(el => el.addEventListener("click", () => selectStory(el.dataset.selectStory, "stories")));
}

export async function selectStory(id, targetPanel = "stories") {
  state.selectedStoryId = id; state.selectedChapterId = null;
  renderStoryList();
  const story = currentStory();
  if (!story) return;
  showPanel(targetPanel);
  setHidden(ui.chapterEditor, true);
  $("story-title").value = story.title || "";
  $("story-subtitle").value = story.subtitle || "";
  $("story-description").value = story.description || "";
  $("story-cover").value = story.coverUrl || "";
  $("story-publish").value = story.status || "draft";
  $("story-status").textContent = statusLabel(story.status);
  $("story-status").className = `status ${story.status === "draft" ? "draft" : ""}`;
  await loadChapters();
}

ui.newStory.addEventListener("click", async () => {
  const title = prompt("Judul cerita:");
  if (!title?.trim()) return;
  try {
    const now = serverTimestamp();
    const baseId = `story-${slugId(title) || Date.now()}`;
    let id = baseId, suffix = 2;
    while ((await getDoc(doc(db, "stories", id))).exists()) id = `${baseId}-${suffix++}`;
    const storyRef = doc(db, "stories", id);
    await setDoc(storyRef, { title: title.trim(), subtitle: "", description: "", coverUrl: "", status: "draft", createdAt: now, updatedAt: now });
    await loadStories(false); await selectStory(id); notify("Cerita dibuat.");
  } catch (error) { notify(`Gagal membuat cerita: ${error.message}`); }
});

ui.storyForm.addEventListener("submit", async event => {
  event.preventDefault(); const story = currentStory(); if (!story) return;
  try {
    await updateDoc(doc(db, "stories", story.id), {
      title: $("story-title").value.trim(),
      subtitle: $("story-subtitle").value.trim(),
      description: $("story-description").value.trim(),
      coverUrl: $("story-cover").value.trim(),
      status: $("story-publish").value,
      updatedAt: serverTimestamp()
    });
    delete cache.stories; delete cache.chapters;
    await loadStories(); notify("Informasi cerita disimpan.");
  } catch (error) { notify(`Gagal menyimpan: ${error.message}`); }
});

$("delete-story-btn").addEventListener("click", async () => {
  const story = currentStory(); if (!story) return;
  if (!confirm(`Hapus cerita “${story.title}” beserta semua bab dan bloknya? Penghapusan subkoleksi Firestore harus dilakukan satu per satu.`)) return;
  try {
    // Firestore tidak menghapus subcollection otomatis; hapus blok, bab, lalu story.
    const chapterSnap = await getDocs(collection(db, "stories", story.id, "chapters"));
    for (const chapterDoc of chapterSnap.docs) {
      const blockSnap = await getDocs(collection(db, "stories", story.id, "chapters", chapterDoc.id, "blocks"));
      for (const blockDoc of blockSnap.docs) await deleteDoc(blockDoc.ref);
      await deleteDoc(chapterDoc.ref);
    }
    await deleteDoc(doc(db, "stories", story.id));
    delete cache.stories; delete cache.chapters;
    state.selectedStoryId = null; await loadStories(false); notify("Cerita dan kontennya dihapus.");
  } catch (error) { notify(`Gagal menghapus: ${error.message}`); }
});
