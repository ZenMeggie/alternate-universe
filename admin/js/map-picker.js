// Map picker (Leaflet + OpenStreetMap). `L` datang dari <script> Leaflet di admin.html.
import { $, notify, setHidden, escapeHtml } from "./utils.js";

let pickerMap = null, pickerMarker = null, pickerLL = null, pickerResolve = null;

function setPick(ll) {
  pickerLL = { lat: Number(Number(ll.lat).toFixed(6)), lng: Number(Number(ll.lng).toFixed(6)) };
  if (!pickerMarker) {
    pickerMarker = L.marker([pickerLL.lat, pickerLL.lng], { draggable: true }).addTo(pickerMap);
    pickerMarker.on("dragend", () => setPick(pickerMarker.getLatLng()));
  } else pickerMarker.setLatLng([pickerLL.lat, pickerLL.lng]);
  $("map-coords").textContent = `${pickerLL.lat}, ${pickerLL.lng}`;
}
function clearPick() {
  pickerLL = null;
  if (pickerMarker) { pickerMarker.remove(); pickerMarker = null; }
  $("map-coords").textContent = "belum dipilih";
}
function closePicker(result) {
  setHidden($("map-modal"), true);
  const r = pickerResolve; pickerResolve = null;
  r?.(result);
}

export function openMapPicker({ lat, lng, name = "" } = {}) {
  return new Promise(resolve => {
    if (typeof L === "undefined") { notify("Leaflet gagal dimuat (periksa koneksi)."); resolve(null); return; }
    pickerResolve = resolve;
    setHidden($("map-modal"), false);
    $("map-name").value = name || ""; $("map-search").value = ""; $("map-results").innerHTML = "";
    setTimeout(() => {
      if (!pickerMap) {
        pickerMap = L.map("map-canvas").setView([1.05, 104.03], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(pickerMap);
        pickerMap.on("click", e => setPick(e.latlng));
      }
      pickerMap.invalidateSize();
      clearPick();
      if (lat !== "" && lat != null && lng !== "" && lng != null) { setPick({ lat, lng }); pickerMap.setView([lat, lng], 15); }
    }, 60);
  });
}

async function searchPlaces() {
  const q = $("map-search").value.trim(); if (!q) return;
  $("map-results").innerHTML = '<span class="muted">Mencari…</span>';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
    const list = await res.json();
    $("map-results").innerHTML = list.length ? list.map((r, i) => `<button type="button" data-i="${i}">${escapeHtml(r.display_name)}</button>`).join("") : '<span class="muted">Tidak ditemukan.</span>';
    $("map-results").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const r = list[Number(b.dataset.i)];
      pickerMap.setView([r.lat, r.lon], 16); setPick({ lat: r.lat, lng: r.lon });
      if (!$("map-name").value.trim()) $("map-name").value = r.display_name.split(",")[0];
    }));
  } catch { $("map-results").innerHTML = '<span class="muted">Pencarian gagal. Klik langsung di peta.</span>'; }
}

$("map-cancel").addEventListener("click", () => closePicker(null));
$("map-confirm").addEventListener("click", () => {
  if (!pickerLL) { notify("Klik peta untuk menaruh pin dulu."); return; }
  closePicker({ ...pickerLL, name: $("map-name").value.trim() });
});
$("map-search-btn").addEventListener("click", searchPlaces);
$("map-search").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); searchPlaces(); } });
