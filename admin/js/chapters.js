import { db, collection, doc, getDocs, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp } from "./firebase.js";
import { $, ui, notify, setHidden, safeDate, statusLabel, escapeHtml, slugId } from "./utils.js";
import { state, cache, currentStory, currentChapter } from "./state.js";
import { loadCol } from "./store.js";
import { loadBlocks } from "./blocks.js";
import { openMapPicker } from "./map-picker.js";

export async function loadChapters() {
  const story = currentStory(); if (!story) return;
  const snap = await getDocs(query(collection(db, "stories", story.id, "chapters"), orderBy("order", "asc")));
  state.chapters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderChapters();
}

export function renderChapters() {
  if (!state.chapters.length) {
    ui.chapterList.innerHTML = '<div class="empty-note">Belum ada bab. Tambahkan bab pertama.</div>'; return;
  }
  ui.chapterList.innerHTML = state.chapters.map(c => `
    <div class="chapter-item ${c.id === state.selectedChapterId ? "active" : ""}">
      <div class="item-main" data-select-chapter="${escapeHtml(c.id)}">
        <div class="item-title">${escapeHtml(c.part || "Part")} — ${escapeHtml(c.title || "Tanpa judul")}</div>
        <div class="item-sub">${escapeHtml(c.date || "Tanpa tanggal")} · ${escapeHtml(c.location || "Lokasi belum diatur")}${c.subtitle ? " · " + escapeHtml(c.subtitle) : ""} · ID chapter/${escapeHtml(c.id)}</div>
      </div><span class="status ${c.status === "draft" ? "draft" : c.status === "coming-soon" ? "coming-soon" : ""}">${escapeHtml(statusLabel(c.status))}</span>
    </div>`).join("");
  ui.chapterList.querySelectorAll("[data-select-chapter]").forEach(el => el.addEventListener("click", () => selectChapter(el.dataset.selectChapter)));
}

export async function selectChapter(id) {
  state.selectedChapterId = id; renderChapters();
  const chapter = currentChapter(); if (!chapter) return;
  setHidden(ui.chapterEditor, false);
  $("chapter-editor-title").textContent = `${chapter.part || "Bab"} — ${chapter.title || ""}`;
  $("chapter-part").value = chapter.part || "";
  $("chapter-title").value = chapter.title || "";
  $("chapter-subtitle").value = chapter.subtitle || "";
  $("chapter-location").value = chapter.location || "";
  $("chapter-location-lat").value = chapter.locationLat ?? "";
  $("chapter-location-lng").value = chapter.locationLng ?? "";
  renderChapterLocationCoordinates();
  $("chapter-date").value = safeDate(chapter.date);
  $("chapter-pov").value = chapter.pov || "";
  $("chapter-alignment").value = chapter.alignment || "left";
  $("chapter-status").value = chapter.status || "draft";
  $("chapter-order").value = Number(chapter.order || 1);
  try { await Promise.all([loadCol("messages"), loadCol("chats")]); } catch { /* opsional: hanya untuk pilihan pesan di blok chat */ }
  await loadBlocks();
}

$("new-chapter-btn").addEventListener("click", async () => {
  const story = currentStory(); if (!story) return;
  try {
    const nextOrder = state.chapters.reduce((m, c) => Math.max(m, Number(c.order || 0)), 0) + 1;
    const part = `Part ${state.chapters.length + 1}`;
    const baseId = `chapter-${slugId(`${part}-${story.id}`)}`;
    let id = baseId, suffix = 2;
    while (state.chapters.some(chapter => chapter.id === id)) id = `${baseId}-${suffix++}`;
    await setDoc(doc(db, "stories", story.id, "chapters", id), {
      part, title: "Bab baru", subtitle: "", date: "", pov: "",
      location: "",
      alignment: "left", status: "draft", order: nextOrder,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    delete cache.chapters;
    await loadChapters(); await selectChapter(id); notify("Bab dibuat.");
  } catch (error) { notify(`Gagal membuat bab: ${error.message}`); }
});

$("close-chapter-btn").addEventListener("click", () => setHidden(ui.chapterEditor, true));

$("chapter-location-picker").addEventListener("click", async () => {
  const result = await openMapPicker({
    lat: $("chapter-location-lat").value,
    lng: $("chapter-location-lng").value,
    name: $("chapter-location").value
  });
  if (!result) return;
  if (!result.name) {
    notify("Isi nama lokasi di pemilih peta.");
    return;
  }
  $("chapter-location").value = result.name;
  $("chapter-location-lat").value = result.lat;
  $("chapter-location-lng").value = result.lng;
  renderChapterLocationCoordinates();
});

function renderChapterLocationCoordinates() {
  const lat = $("chapter-location-lat").value;
  const lng = $("chapter-location-lng").value;
  $("chapter-location-coords").textContent = lat !== "" && lng !== ""
    ? `Koordinat cuaca: ${lat}, ${lng}`
    : "Koordinat belum dipilih. Pilih titik di peta agar lokasi cuaca akurat.";
}

ui.chapterForm.addEventListener("submit", async event => {
  event.preventDefault(); const chapter = currentChapter(), story = currentStory(); if (!chapter || !story) return;
  const date = $("chapter-date").value;
  const location = $("chapter-location").value.trim();
  const locationLat = $("chapter-location-lat").value === "" ? null : Number($("chapter-location-lat").value);
  const locationLng = $("chapter-location-lng").value === "" ? null : Number($("chapter-location-lng").value);
  const status = $("chapter-status").value;
  if (status !== "draft" && (!date || !location || locationLat == null || locationLng == null)) {
    notify("Tanggal dan lokasi dari peta wajib diisi sebelum part diterbitkan atau dijadwalkan.");
    return;
  }
  if (locationLat != null && (!Number.isFinite(locationLat) || locationLat < -90 || locationLat > 90)
    || locationLng != null && (!Number.isFinite(locationLng) || locationLng < -180 || locationLng > 180)) {
    notify("Koordinat lokasi tidak valid. Pilih ulang titik di peta.");
    return;
  }
  if (date) {
    const parsedDate = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== date) {
      notify("Tanggal timeline tidak valid.");
      return;
    }
  }
  try {
    const updatedChapter = {
      ...chapter,
      part: $("chapter-part").value.trim(), title: $("chapter-title").value.trim(),
      subtitle: $("chapter-subtitle").value.trim(), location, locationLat, locationLng, date,
      pov: $("chapter-pov").value.trim(), alignment: $("chapter-alignment").value,
      status, order: Number($("chapter-order").value || 0)
    };
    await updateDoc(doc(db, "stories", story.id, "chapters", chapter.id), {
      part: updatedChapter.part, title: updatedChapter.title,
      subtitle: updatedChapter.subtitle, location: updatedChapter.location,
      locationLat: updatedChapter.locationLat, locationLng: updatedChapter.locationLng, date: updatedChapter.date,
      pov: updatedChapter.pov, alignment: updatedChapter.alignment,
      status: updatedChapter.status, order: updatedChapter.order,
      updatedAt: serverTimestamp()
    });
    await syncChapterTimeline(story.id, updatedChapter);
    delete cache.chapters;
    await loadChapters(); notify("Bab disimpan. Timeline dan cuaca mengikuti part.");
  } catch (error) { notify(`Gagal menyimpan bab: ${error.message}`); }
});

async function syncChapterTimeline(storyId, chapter) {
  const snap = await getDocs(collection(db, "timeline"));
  const days = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const belongsToChapter = day => (day.parts || []).some(part => part.chapterId === chapter.id && part.storyId === storyId);
  const previousDay = days.find(day => belongsToChapter(day));
  const shouldAppear = chapter.status !== "draft" && chapter.date && chapter.location;

  if (previousDay && (!shouldAppear || previousDay.date !== chapter.date)) {
    const remaining = previousDay.parts.filter(part => !(part.chapterId === chapter.id && part.storyId === storyId));
    if (remaining.length) await writeTimelineParts(previousDay.ref, previousDay, remaining, previousDay.date);
    else if (previousDay._managedBy === "chapters" && !(previousDay.events || []).length) await deleteDoc(previousDay.ref);
    else await updateDoc(previousDay.ref, { parts: [], location: "", locationLat: null, locationLng: null, updatedAt: serverTimestamp() });
  }
  if (!shouldAppear) return;

  const targetDay = days.find(day => day.date === chapter.date);
  let targetRef = targetDay?.ref;
  if (!targetRef) {
    const baseId = `day-${slugId(chapter.date)}`;
    let id = baseId, suffix = 2;
    while (days.some(day => day.id === id && day.date !== chapter.date)) id = `${baseId}-${suffix++}`;
    targetRef = doc(db, "timeline", id);
  }
  const current = targetDay || (previousDay?.date === chapter.date ? previousDay : null);
  const parts = (current?.parts || []).filter(part => !(part.chapterId === chapter.id && part.storyId === storyId));
  parts.push({
    chapterId: chapter.id, storyId, part: chapter.part, title: chapter.title,
    subtitle: chapter.subtitle, location: chapter.location, locationLat: chapter.locationLat,
    locationLng: chapter.locationLng, order: chapter.order || 0
  });
  await writeTimelineParts(targetRef, current, parts, chapter.date);
}

async function writeTimelineParts(ref, current, parts, date) {
  const sorted = [...parts].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const primary = sorted[sorted.length - 1];
  if (!primary) return;
  const day = {
    ...(current || {}),
    date,
    label: primary.part || "",
    title: primary.title || "",
    summary: primary.subtitle || "",
    location: primary.location || "",
    locationLat: primary.locationLat ?? null,
    locationLng: primary.locationLng ?? null,
    parts: sorted,
    ...(current?._managedBy ? { _managedBy: current._managedBy } : current ? {} : { _managedBy: "chapters" }),
    updatedAt: serverTimestamp()
  };
  delete day.id;
  delete day.ref;
  await setDoc(ref, day, { merge: true });
}

$("delete-chapter-btn").addEventListener("click", async () => {
  const story = currentStory(), chapter = currentChapter(); if (!story || !chapter) return;
  if (!confirm(`Hapus bab “${chapter.title}” beserta semua bloknya?`)) return;
  try {
    const snap = await getDocs(collection(db, "stories", story.id, "chapters", chapter.id, "blocks"));
    for (const b of snap.docs) await deleteDoc(b.ref);
    await syncChapterTimeline(story.id, { ...chapter, status: "draft" });
    await deleteDoc(doc(db, "stories", story.id, "chapters", chapter.id));
    delete cache.chapters;
    state.selectedChapterId = null; setHidden(ui.chapterEditor, true); await loadChapters(); notify("Bab dihapus.");
  } catch (error) { notify(`Gagal menghapus bab: ${error.message}`); }
});
