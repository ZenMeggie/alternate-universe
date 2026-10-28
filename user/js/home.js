// Home screen ala iOS: widget Weather + Calendar (dengan label), grid app, dot halaman, dock.
// Semua class memakai prefix "hs-" supaya tidak bentrok dengan CSS lama (.ios-*, .widget, .home).

import { getState, subscribe } from './state.js';
import {
  getCharacter,
  countsFor,
  onStoreChange,
  getCollection,
  getTimeline,
} from './data/store.js';
import { APP_META } from './icons.js';
import { esc, $, formatWeekday, formatDayNumber } from './utils.js';
import { getMusicState, onMusicChange, toggleMusic } from './music-player.js';

const HOME_PAGES = [
  ['notes', 'stories', 'whatsapp', 'twitter', 'gallery', 'settings', 'calculator', 'calender'],
  ['music'],
];
const DOCK = ['whatsapp', 'twitter', 'gallery', 'settings'];

const weatherCache = new Map();
let weatherRequestId = 0;
let homeSearch = '';
let homePage = 0;

function currentMusicAudio() {
  return getMusicState();
}

function updateMusicWidget() {
  const widget = $('#home-music');
  if (!widget) return;

  const audio = currentMusicAudio();
  const label = widget.querySelector('.hs-music__title');
  const status = widget.querySelector('.hs-music__status');
  const control = widget.querySelector('.hs-music__control');
  if (!label || !status || !control) return;

  label.textContent = audio.title || 'Nothing Playing';
  status.textContent = audio.error || (audio.url
    ? (audio.playing ? 'Now Playing' : audio.playlistId?.startsWith('music:character:') ? 'Character music' : 'Stories playlist')
    : 'Open Music to find songs');
  control.setAttribute('aria-label', audio.playing ? 'Pause music' : audio.url ? 'Play music' : 'Open Music');
  control.disabled = !audio.url;
  control.innerHTML = audio.playing
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
}

function filterHomeApps(query) {
  const normalized = query.trim().toLocaleLowerCase();
  let matches = 0;
  for (const app of $('#home-content')?.querySelectorAll('.hs-grid .hs-icon') || []) {
    const visible = app.dataset.title.toLocaleLowerCase().includes(normalized);
    app.hidden = !visible;
    if (visible) matches += 1;
  }
  const empty = $('#home-search-empty');
  if (empty) empty.hidden = matches > 0;
}

/* ---------- util tanggal & waktu ---------- */

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeDate(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  let dateValue = value;
  if (typeof value?.toDate === 'function') dateValue = value.toDate();
  else if (typeof value?.seconds === 'number') dateValue = new Date(value.seconds * 1000);
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(date.getTime()) ? '' : localDateString(date);
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTimeFromValue(value) {
  if (!value) return '';
  const match = String(value).match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : '';
}

/* ---------- timeline & lokasi cerita ---------- */

function getActiveDay(date, timeline) {
  return timeline.find((day) => normalizeDate(day.date) === date) || null;
}

function getActiveEvent(date, timeline) {
  const day = getActiveDay(date, timeline);
  if (!day || !Array.isArray(day.events)) return null;
  const events = [...day.events];
  events.sort((a, b) => {
    const timeA = getTimeFromValue(a.time || a.startTime) || '99:99';
    const timeB = getTimeFromValue(b.time || b.startTime) || '99:99';
    return timeA.localeCompare(timeB);
  });
  return events[0] || null;
}

function eventPlaceReference(event) {
  if (!event) return '';
  const reference = event.placeId ?? event.locationId ?? event.place_id ?? event.location_id ?? event.placeRef ?? '';
  if (typeof reference === 'string') return reference;
  if (reference && typeof reference === 'object') return String(reference.id || reference.path || '');
  return '';
}

function findStoryPlace(places, date, event) {
  const reference = eventPlaceReference(event);
  if (reference) {
    const byId = places.find((p) => String(p.id || p.docId || p.uid || '') === reference);
    if (byId) return byId;
  }
  const eventPlaceName = String(
    event?.placeName || event?.locationName ||
    (typeof event?.place === 'string' ? event.place : '') ||
    (typeof event?.location === 'string' ? event.location : '')
  ).trim().toLowerCase();
  if (eventPlaceName) {
    const byName = places.find((p) => String(p.name || p.title || p.location || p.address || '').trim().toLowerCase() === eventPlaceName);
    if (byName) return byName;
  }
  const dated = places.find((p) => normalizeDate(p.date || p.storyDate || p.story_date || p.timestamp || p.startAt) === date);
  return dated || places[0] || null;
}

function getStoryTime(date, place, event) {
  const eventTime = getTimeFromValue(event?.time || event?.startTime || event?.start_at);
  if (eventTime) return eventTime;
  const placeTime = getTimeFromValue(place?.time || place?.startTime || place?.start_at);
  if (placeTime) return placeTime;
  const timestamp = timestampToDate(place?.timestamp || place?.startAt || place?.dateTime);
  if (timestamp && normalizeDate(timestamp) === date) {
    return `${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
  }
  return '12:00';
}

function resolveLocation(place) {
  if (!place) return null;
  const latitudeValue = place.latitude ?? place.lat ?? place.coordinates?.latitude ?? place.coordinates?.lat;
  const longitudeValue = place.longitude ?? place.lon ?? place.lng ?? place.coordinates?.longitude ?? place.coordinates?.lon ?? place.coordinates?.lng;
  const latitude = latitudeValue == null || latitudeValue === '' ? NaN : Number(latitudeValue);
  const longitude = longitudeValue == null || longitudeValue === '' ? NaN : Number(longitudeValue);
  const name = String(place.name || place.title || place.location || place.address || 'Lokasi cerita');
  const timezone = String(place.timezone || '');
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
    return { name, latitude, longitude, timezone };
  }
  const query = String(place.address || place.location || place.city || place.name || place.title || '').trim();
  return query ? { name, query, timezone } : null;
}

/* ---------- cuaca (Open-Meteo) ---------- */

async function geocodeLocation(location) {
  if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) return location;
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', location.query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Lokasi cerita tidak dapat dicari.');
  const result = (await response.json()).results?.[0];
  if (!result) throw new Error(`Lokasi "${location.query}" tidak ditemukan.`);
  return {
    ...location,
    name: [result.name, result.admin1, result.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: location.timezone || result.timezone || 'auto',
  };
}

function weatherDescription(code, isDay = 1) {
  if (code === 0) return isDay ? 'Cerah' : 'Cerah malam';
  if (code === 1) return 'Cerah sebagian';
  if (code === 2) return 'Berawan sebagian';
  if (code === 3) return 'Mendung';
  if ([45, 48].includes(code)) return 'Berkabut';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Gerimis';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Hujan';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Bersalju';
  if ([95, 96, 99].includes(code)) return 'Badai petir';
  return 'Kondisi cuaca';
}

function weatherIcon(code, isDay = 1) {
  if ([95, 96, 99].includes(code)) return '⛈️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([45, 48].includes(code)) return '🌫️';
  if (code === 0) return isDay ? '☀️' : '🌙';
  if ([1, 2].includes(code)) return isDay ? '🌤️' : '☁️';
  return '☁️';
}

async function fetchWeather(location, date, time) {
  const resolved = await geocodeLocation(location);
  const today = localDateString();
  const isPast = date < today;
  const isFuture = date > today;
  const dayDifference = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);

  if (isFuture && dayDifference > 16) {
    return { unavailable: true, location: resolved.name, message: 'Prakiraan belum tersedia sejauh tanggal cerita ini.' };
  }

  const url = new URL(isPast ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(resolved.latitude));
  url.searchParams.set('longitude', String(resolved.longitude));
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);
  url.searchParams.set('hourly', ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation', 'weather_code', 'wind_speed_10m', 'is_day'].join(','));
  url.searchParams.set('timezone', resolved.timezone || 'auto');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const response = await fetch(url);
  if (!response.ok) throw new Error('Data cuaca tidak tersedia untuk tanggal tersebut.');
  const hourly = (await response.json()).hourly;
  if (!hourly?.time?.length) throw new Error('Tidak ada data cuaca untuk waktu cerita ini.');

  const targetHour = Number(String(time || '12:00').slice(0, 2));
  let index = hourly.time.findIndex((v) => Number(v.slice(11, 13)) === targetHour);
  if (index < 0) index = Math.min(12, hourly.time.length - 1);

  return {
    location: resolved.name,
    date,
    time: hourly.time[index]?.slice(11, 16) || time,
    temperature: hourly.temperature_2m?.[index],
    code: hourly.weather_code?.[index],
    isDay: hourly.is_day?.[index] ?? 1,
  };
}

/* ---------- markup widget ---------- */

const ARROW = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8-8-2Z"/></svg>';

/** Isi widget cuaca: lokasi, suhu besar, kondisi di bawah. */
function wxHtml({ place, temp, icon, text }) {
  return `
    <div class="hs-wx__place"><span class="hs-wx__name">${esc(place)}</span>${ARROW}</div>
    <div class="hs-wx__temp">${esc(temp)}</div>
    <div class="hs-wx__cond"><span class="hs-wx__icon" aria-hidden="true">${icon}</span><span>${esc(text)}</span></div>`;
}

function wxView(weather) {
  if (weather.unavailable) {
    return { night: false, html: wxHtml({ place: weather.location, temp: '--°', icon: '🌤️', text: 'Belum tersedia' }) };
  }
  const temp = Number.isFinite(weather.temperature) ? `${Math.round(weather.temperature)}°` : '--°';
  return {
    night: !weather.isDay,
    html: wxHtml({
      place: weather.location,
      temp,
      icon: weatherIcon(weather.code, weather.isDay),
      text: weatherDescription(weather.code, weather.isDay),
    }),
  };
}

const wxLoading = (location) => wxHtml({ place: location?.name || 'Weather', temp: '--°', icon: '🌤️', text: 'Memuat…' });
const wxKey = (date, time, loc) => [date, time, loc?.latitude ?? '', loc?.longitude ?? '', loc?.query ?? ''].join('|');

function setWeather(node, view) {
  node.className = `hs-widget hs-wx${view.night ? ' is-night' : ''}`;
  node.innerHTML = view.html;
}

async function updateWeatherWidget(date, time, location) {
  const node = $('#story-weather');
  if (!node) return;
  const requestId = ++weatherRequestId;

  if (!location) {
    setWeather(node, { night: false, html: wxHtml({ place: 'Lokasi?', temp: '--°', icon: '📍', text: 'Atur tempat di admin' }) });
    return;
  }

  const key = wxKey(date, time, location);
  try {
    let weather = weatherCache.get(key);
    if (!weather) {
      weather = await fetchWeather(location, date, time);
      weatherCache.set(key, weather);
    }
    if (requestId !== weatherRequestId) return; // tanggal berubah saat request berjalan
    setWeather(node, wxView(weather));
  } catch (error) {
    if (requestId !== weatherRequestId) return;
    setWeather(node, { night: false, html: wxHtml({ place: location.name, temp: '--°', icon: '⚠️', text: 'Tidak dapat dimuat' }) });
  }
}

function calendarWidget(date, day) {
  return `
    <button type="button" class="hs-widget hs-cal" data-action="open-app" data-app="calender" aria-label="Buka Calendar">
      <span class="hs-cal__dow">${esc(formatWeekday(date))}</span>
      <b class="hs-cal__num">${esc(formatDayNumber(date))}</b>
      <span class="hs-cal__ev">${esc(day?.title || 'No more events today')}</span>
    </button>`;
}

function appButton(id, counts, dock = false) {
  const meta = APP_META[id];
  if (!meta) return '';
  const count = counts[id] || 0;
  return `
    <button type="button" class="hs-icon" data-action="open-app" data-app="${esc(id)}"
      data-title="${esc(meta.title)}"
      aria-label="${esc(meta.title)}${count ? `, ${count} new today` : ''}">
      <span class="app-tile">
        ${meta.tile}
        ${count ? `<span class="badge" aria-hidden="true">${count}</span>` : ''}
      </span>
      ${dock ? '' : `<span class="hs-icon__label">${esc(meta.title)}</span>`}
    </button>`;
}

/* ---------- render ---------- */

export function renderHome() {
  const root = $('#home-content');
  if (!root) return;

  const state = getState();
  if (!getCharacter(state.activeCharacterId)) { root.innerHTML = ''; return; }

  const timeline = getTimeline();
  const places = getCollection('places') || [];
  const activeDate = normalizeDate(state.activeStoryDate || localDateString()) || localDateString();

  const day = getActiveDay(activeDate, timeline);
  const event = getActiveEvent(activeDate, timeline);
  const place = findStoryPlace(places, activeDate, event);
  const chapterLocation = day?.location ? {
    name: day.location, location: day.location,
    latitude: day.locationLat, longitude: day.locationLng
  } : null;
  const location = resolveLocation(chapterLocation || place);
  const activeTime = getStoryTime(activeDate, place, event);
  const counts = countsFor(state);

  // pakai cuaca yang sudah di-cache supaya tidak berkedip "Memuat…" tiap render ulang
  const cached = location ? weatherCache.get(wxKey(activeDate, activeTime, location)) : null;
  const wx = cached ? wxView(cached) : { night: false, html: wxLoading(location) };

  root.innerHTML = `
    <div class="hs">
            <div class="hs-pages" data-home-pages>
        <div class="hs-page-track" style="transform:translateX(-${homePage * 100}%)">
          <section class="hs-page" aria-label="Page 1">
            <div class="hs-widgets">
              <div class="hs-cell">
                <section id="story-weather" class="hs-widget hs-wx${wx.night ? ' is-night' : ''}" aria-label="Cuaca cerita" aria-live="polite">${wx.html}</section>
              </div>
              <div class="hs-cell">
                ${calendarWidget(activeDate, day)}
              </div>
            </div>

            <div class="hs-music" id="home-music">
              <button type="button" class="hs-music__browse" data-action="open-app" data-app="music" aria-label="Open Music">
                <span class="hs-music__art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 8l12-2M5 18a3 2 0 1 0 6 0 3 2 0 0 0-6 0Zm12-2a3 2 0 1 0 6 0 3 2 0 0 0-6 0Z"/></svg></span>
                <span class="hs-music__copy"><strong class="hs-music__title">Nothing Playing</strong><span class="hs-music__status">Open Music to find songs</span></span>
              </button>
              <button type="button" class="hs-music__control" aria-label="Open Music">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>
              </button>
            </div>
            <span class="hs-widget-label">Music</span>

            <nav class="hs-grid hs-grid--page" aria-label="Apps, page 1">${HOME_PAGES[0].map((id) => appButton(id, counts)).join('')}</nav>
          </section>

          ${HOME_PAGES.slice(1).map((apps, i) => `<section class="hs-page hs-page--apps" aria-label="Page ${i + 2}"><nav class="hs-grid hs-grid--page" aria-label="Apps, page ${i + 2}">${apps.map((id) => appButton(id, counts)).join('')}</nav></section>`).join('')}
        </div>
      </div>

      <nav class="hs-dots" aria-label="Home screen pages">
        ${HOME_PAGES.map((_, index) => `<button type="button" class="${index === homePage ? 'is-active' : ''}" data-home-page="${index}" aria-label="Page ${index + 1}" aria-current="${index === homePage ? 'page' : 'false'}"></button>`).join('')}
      </nav>

      <p id="home-search-empty" class="hs-search-empty" hidden>No apps found</p>
      <label class="hs-search" aria-label="Search apps">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>
        <input class="hs-search__input" type="search" placeholder="Search" value="${esc(homeSearch)}" autocomplete="off" aria-label="Search apps">
      </label>

      <nav class="hs-dock" aria-label="Dock">${DOCK.map((id) => appButton(id, counts, true)).join('')}</nav>
    </div>`;

  filterHomeApps(homeSearch);
  updateMusicWidget();
  updateWeatherWidget(activeDate, activeTime, location);
}

export function initHome() {
  renderHome();
  const homeContent = $('#home-content');

  // Geser halaman tanpa render ulang, supaya animasi CSS jalan.
  const goToPage = () => {
    const track = homeContent?.querySelector('.hs-page-track');
    if (track) track.style.transform = `translateX(-${homePage * 100}%)`;
    homeContent?.querySelectorAll('.hs-dots button').forEach((b, i) => {
      b.classList.toggle('is-active', i === homePage);
      b.setAttribute('aria-current', i === homePage ? 'page' : 'false');
    });
  };

  homeContent?.addEventListener('input', (event) => {
    if (!event.target.matches('.hs-search__input')) return;
    homeSearch = event.target.value;
    filterHomeApps(homeSearch);
  });

  let swipeStart = null;
  homeContent?.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('[data-home-pages]')) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  homeContent?.addEventListener('pointerup', (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    event.preventDefault();
    homePage = Math.max(0, Math.min(HOME_PAGES.length - 1, homePage + (dx < 0 ? 1 : -1)));
    goToPage();
  });
  homeContent?.addEventListener('pointercancel', () => { swipeStart = null; });

  homeContent?.addEventListener('click', async (event) => {
    const pageButton = event.target.closest('[data-home-page]');
    if (pageButton) {
      homePage = Number(pageButton.dataset.homePage) || 0;
      goToPage();
      return;
    }
    const control = event.target.closest('.hs-music__control');
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    try { await toggleMusic(); }
    catch (error) { console.warn('Unable to play story music', error); }
  });

  onMusicChange(updateMusicWidget);
  onStoreChange(renderHome);
  subscribe((_state, changed) => {
    if (changed.some((key) => key === 'activeCharacterId' || key === 'activeStoryDate')) renderHome();
  });
}