// Gallery / Memories: photo grid, albums (by place), photo detail + narration, Leaflet + OpenStreetMap map.
// Leaflet is loaded as a global `L` by index.html (vendored in /vendor/leaflet).

import { getState, subscribe, consumeFocus } from '../state.js';
import { registerApp } from '../navigation.js';
import { startStore, onStoreChange, isStoreReady, galleryFor, allPhotosOf, getCharacter, avatarHtml, eventLinks, getEvent } from '../data/store.js';
import { icon } from '../icons.js';
import { esc, formatFullStamp, formatDayMonth, groupBy, plural } from '../utils.js';
import { appTop, emptyState, scopeToggle, linkChips, openModal } from '../ui.js';

let root;
let mode = 'grid'; // 'grid' | 'albums' | 'map'
let selectedPhotoId = null; // photo highlighted on the map
let map = null;
let markerLayer = null;
let markers = new Map();
let mapKey = '';

const nameOf = (id) => getCharacter(id)?.name.split(' ')[0] || id;
const hasCoords = (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
const safeLinks = (...args) => {
  try {
    return eventLinks(...args) || [];
  } catch {
    return [];
  }
};

function tabs() {
  const t = (id, label, ic) =>
    `<button type="button" class="segmented__btn ${mode === id ? 'is-active' : ''}" data-action="gallery-mode" data-mode="${id}" aria-pressed="${mode === id}">${icon(ic, 15)} ${label}</button>`;
  return `<div class="segmented segmented--tabs" role="group" aria-label="Gallery view">${t('grid', 'Photos', 'image')}${t('albums', 'Albums', 'layers')}${t('map', 'Map', 'map')}</div>`;
}

const thumb = (p) => `<button type="button" class="photo" data-action="open-photo" data-id="${esc(p.id)}" aria-label="${esc(p.caption || p.locationName)}">
  <img src="${esc(p.image)}" alt="${esc(p.alt || p.caption || '')}" loading="lazy" decoding="async">
  <span class="photo__cap"><strong>${esc(p.caption || p.activity)}</strong><small>${icon('pin', 11)} ${esc(p.locationName.split(',')[0])}</small></span>
</button>`;

function gridView(photos) {
  const byDay = groupBy(photos, (p) => p.date);
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => `<section class="photo-day"><h2>${esc(formatDayMonth(day))} <small>${plural(list.length, 'photo')}</small></h2><div class="photo-grid">${list.map(thumb).join('')}</div></section>`)
    .join('');
}

function albumsView(photos) {
  const byPlace = groupBy(photos, (p) => p.locationName);
  return `<div class="albums">${[...byPlace.entries()]
    .map(
      ([place, list]) => `<section class="album">
        <div class="album__cover">${list.slice(0, 3).map((p) => `<img src="${esc(p.image)}" alt="" loading="lazy">`).join('')}</div>
        <div class="album__body"><h2>${esc(place)}</h2><p>${plural(list.length, 'photo')} · ${esc(list.map((p) => formatDayMonth(p.date)).filter((v, i, a) => a.indexOf(v) === i).join(', '))}</p></div>
        <div class="photo-grid photo-grid--sm">${list.map(thumb).join('')}</div>
      </section>`
    )
    .join('')}</div>`;
}

function mapView(photos) {
  return `<div class="map-wrap">
    <div id="photo-map" class="photo-map" role="region" aria-label="Map of photo locations"></div>
    <div class="map-legend"><span><i class="dot dot--on"></i> Selected day</span><span><i class="dot dot--off"></i> Other days</span>
      <span class="map-count">${plural(photos.length, 'place marker')}</span></div>
  </div>`;
}

/* ---------- map ---------- */

function pinIcon(on, selected) {
  return L.divIcon({
    className: `pin ${on ? 'pin--on' : 'pin--off'} ${selected ? 'pin--selected' : ''}`,
    html: '<span></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function popupHtml(p) {
  return `<div class="map-pop">
    <img src="${esc(p.image)}" alt="${esc(p.alt || '')}">
    <strong>${esc(p.caption || p.activity)}</strong>
    <span>${icon('pin', 12)} ${esc(p.locationName)}</span>
    <span>${icon('clock', 12)} ${esc(formatFullStamp(p.timestamp))}</span>
    <span>${esc(p.activity)}</span>
    <em>${esc(p.context)}</em>
    <button type="button" data-action="open-photo" data-id="${esc(p.id)}">Open photo</button>
  </div>`;
}

function destroyMap() {
  if (map) {
    map.remove();
    map = null;
    markerLayer = null;
    markers = new Map();
    mapKey = '';
  }
}

function mapSignature(state) {
  return `${state.activeCharacterId}|${state.activeStoryDate}|${state.scope}|${allPhotosOf(state.activeCharacterId).length}`;
}

function drawMap(state, visible) {
  const el = root.querySelector('#photo-map');
  if (!el) return;
  if (typeof L === 'undefined') {
    el.innerHTML = emptyState({ iconName: 'map', title: 'Map library not loaded', text: 'Check that vendor/leaflet/leaflet.js is being served.' });
    return;
  }
  destroyMap();
  map = L.map(el, { zoomControl: true, scrollWheelZoom: true, attributionControl: true });
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);
  let tileErrors = 0;
  tiles.on('tileerror', () => {
    if (++tileErrors === 3) el.classList.add('map--offline');
  });

  markerLayer = L.layerGroup().addTo(map);
  const visibleIds = new Set(visible.map((p) => p.id));
  const all = allPhotosOf(state.activeCharacterId).filter(hasCoords);
  const bounds = [];
  for (const p of all) {
    const on = visibleIds.has(p.id);
    const marker = L.marker([p.latitude, p.longitude], { icon: pinIcon(on, p.id === selectedPhotoId), title: p.caption || p.locationName, opacity: on ? 1 : 0.55, zIndexOffset: on ? 500 : 0 })
      .bindPopup(popupHtml(p), { maxWidth: 260, minWidth: 220 })
      .on('click', () => (selectedPhotoId = p.id))
      .addTo(markerLayer);
    markers.set(p.id, marker);
    if (on) bounds.push([p.latitude, p.longitude]);
  }
  const fit = bounds.length ? bounds : all.map((p) => [p.latitude, p.longitude]);
  if (fit.length === 1) map.setView(fit[0], 14);
  else if (fit.length > 1) map.fitBounds(fit, { padding: [50, 50], maxZoom: 15 });
  else map.setView([1.05, 104.03], 11);
  mapKey = mapSignature(state);

  if (selectedPhotoId && markers.has(selectedPhotoId)) {
    const m = markers.get(selectedPhotoId);
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 14));
    m.openPopup();
  }
  setTimeout(() => map && map.invalidateSize(), 60);
}

/* ---------- photo detail ---------- */

function photoModal(id) {
  const state = getState();
  const p = allPhotosOf(state.activeCharacterId).find((x) => x.id === id);
  if (!p) return;
  const ev = p.eventId ? getEvent(p.eventId) : null;
  const links = ev ? safeLinks(p.eventId, p.characterId, { type: 'photo', id: p.id }) : [];
  const people = p.people.map((pid) => getCharacter(pid)).filter(Boolean);
  const photographer = getCharacter(p.photographerId);
  const storyId = p.storyId || null;
  openModal({
    className: 'modal--photo',
    label: p.caption || 'Photo',
    html: `<div class="photo-detail">
      <img src="${esc(p.image)}" alt="${esc(p.alt || '')}">
      <div class="photo-detail__body">
        <p class="eyebrow">${esc(formatFullStamp(p.timestamp))}</p>
        <h2>${esc(p.caption || p.activity)}</h2>
        <dl class="facts">
          <dt>${icon('pin', 14)} Location</dt><dd>${esc(p.locationName)}${hasCoords(p) ? `<small>${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</small>` : ''}</dd>
          <dt>${icon('camera', 14)} Photographer</dt><dd>${esc(photographer ? photographer.name : p.photographerId)}</dd>
          <dt>${icon('users', 14)} In the photo</dt><dd class="people">${people.map((c) => `<span class="person">${avatarHtml(c, 22)}${esc(c.name.split(' ')[0])}</span>`).join('') || 'No one'}</dd>
          <dt>${icon('sparkle', 14)} Activity</dt><dd>${esc(p.activity)}</dd>
        </dl>
        <p class="photo-detail__ctx">${esc(p.context)}</p>
        <div class="photo-detail__actions">
          ${p.narrationId ? `
            <button
              type="button"
              class="btn btn--solid"
              data-action="open-narration"
              data-id="${esc(p.narrationId)}"
            >${icon('info', 16)} Story behind this photo</button>
          ` : ''}

          ${storyId ? `
            <button
              type="button"
              class="btn btn--ghost"
              data-action="open-story-chapter"
              data-story="${esc(storyId)}"
              data-chapter="${esc(p.chapterId || '')}"
            >${icon('book-open', 16)} Full Story</button>
          ` : ''}

          ${hasCoords(p) ? `<button
            type="button"
            class="btn btn--ghost"
            data-action="show-on-map"
            data-id="${esc(p.id)}"
          >${icon('map', 16)} Show on map</button>` : ''}
        </div>
        ${ev && links.length ? `<div class="related"><p class="eyebrow">Story moment: ${esc(ev.title)}</p>${linkChips(links)}</div>` : ''}
      </div>
    </div>`,
  });
}

/* ---------- main render ---------- */

export function renderGallery() {
  const state = getState();
  const photos = galleryFor(state);

  if (state.focus && state.focus.type === 'photo') {
    selectedPhotoId = state.focus.id;
    mode = 'grid';
    const id = state.focus.id;
    consumeFocus();
    setTimeout(() => photoModal(id), 360);
  }

  const showMap = mode === 'map';
  const sameMap = showMap && map && mapKey === mapSignature(state) && root.querySelector('#photo-map');
  if (sameMap) return; // nothing changed that affects the map; leave it alone

  if (!showMap) destroyMap();

  let content;
  if (!isStoreReady()) {
    content = emptyState({ iconName: 'image', title: 'Loading…', text: 'Fetching photos.' });
  } else if (!photos.length && !showMap) {
    content = emptyState({
      iconName: 'image',
      title: 'No photos',
      text: `${nameOf(state.activeCharacterId)} didn't take or keep any photos ${state.scope === 'day' ? 'on this day' : 'by this day'}.`,
      actionHtml: state.scope === 'day' ? `<button class="btn btn--ghost" data-action="set-scope" data-scope="upto">Show earlier photos</button>` : '',
    });
  } else if (mode === 'albums') content = albumsView(photos);
  else if (showMap) content = mapView(photos);
  else content = gridView(photos);

  root.innerHTML = `
    ${appTop({ appId: 'gallery', title: 'Gallery', subtitle: plural(photos.length, 'photo'), state, extra: scopeToggle(state.scope) })}
    <div class="gallery-bar">${tabs()}</div>
    <div class="gallery-body ${showMap ? 'is-map' : ''}">${content}</div>`;

  if (showMap) drawMap(state, photos);
}

export function initGallery(registerAction) {
  root = document.getElementById('app-gallery');
  registerAction('gallery-mode', (el) => {
    mode = el.dataset.mode;
    mapKey = '';
    renderGallery();
  });
  registerAction('open-photo', (el) => {
    selectedPhotoId = el.dataset.id;
    map?.closePopup();
    photoModal(el.dataset.id);
  });
  registerAction('show-on-map', (el) => {
    selectedPhotoId = el.dataset.id;
    mode = 'map';
    mapKey = '';
    document.querySelector('.modal-backdrop .modal__close')?.click();
    renderGallery();
  });
  registerApp('gallery', {
    root,
    render: renderGallery,
    onShow: () => map && setTimeout(() => map.invalidateSize(), 380),
  });
  startStore();
  renderGallery();
  onStoreChange(() => renderGallery());
  subscribe((state, changed) => {
    if (changed.includes('activeApp') && state.activeApp === 'gallery' && map) setTimeout(() => map.invalidateSize(), 380);
    if (changed.some((k) => ['activeCharacterId', 'activeStoryDate', 'scope', 'focus'].includes(k))) renderGallery();
  });
}
