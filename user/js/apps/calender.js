
import { registerApp } from '../navigation.js';
import { setDate } from '../state.js';
import { getTimeline, onStoreChange } from '../data/store.js';

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
});

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
});

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const TIME_ZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_FORMAT.format(new Date(2024, 0, i + 1))
);

function keyOf(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function todayKey() {
  const d = new Date();
  return keyOf(d.getFullYear(), d.getMonth(), d.getDate());
}

function validTimeline() {
  return getTimeline()
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function monthRange(first, last) {
  const [sy, sm] = first.split('-').map(Number);
  const [ey, em] = last.split('-').map(Number);
  const result = [];

  let year = sy;
  let month = sm - 1;

  while (year < ey || (year === ey && month <= em - 1)) {
    result.push({ year, month });

    if (++month > 11) {
      month = 0;
      year++;
    }
  }

  return result;
}

function renderMonth({ year, month }, selected, dates) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  let html = '';

  for (let cell = 0; cell < total; cell++) {
    const day = cell - mondayOffset + 1;

    if (day < 1 || day > daysInMonth) {
      html += '<span class="ios-cal-day ios-cal-blank"></span>';
      continue;
    }

    const date = keyOf(year, month, day);
    const weekday = cell % 7;
    const weekend = weekday >= 5;
    const isSelected = date === selected;
    const hasStory = dates.has(date);

    html += `
      <button
        type="button"
        class="ios-cal-day ${weekend ? 'is-weekend' : ''} ${isSelected ? 'is-selected' : ''} ${hasStory ? 'has-story' : ''}"
        data-calendar-date="${date}"
        aria-label="${date}"
        aria-pressed="${isSelected}"
      >
        <span class="ios-cal-number">${day}</span>
        ${hasStory ? '<span class="ios-cal-dot"></span>' : ''}
      </button>
    `;
  }

  return `
    <section class="ios-cal-month" data-month="${year}-${String(month + 1).padStart(2, '0')}">
      <h2>${escapeHTML(MONTH_FORMAT.format(new Date(year, month, 1)))}</h2>
      <div class="ios-cal-grid">${html}</div>
    </section>
  `;
}

function renderSchedule(selected, timeline) {
  const entry = timeline.find(item => item.date === selected);
  const events = Array.isArray(entry?.events) ? entry.events : [];

  if (!events.length) {
    return `
      <div class="ios-cal-empty">
        <strong>No Events</strong>
        <p>Tidak ada event pada tanggal ini.</p>
      </div>
    `;
  }

  return `
    <ol class="ios-cal-events">
      ${events.map(event => `
        <li>
          <time>${escapeHTML(event.time || '')}</time>
          <div>
            <strong>${escapeHTML(event.title || 'Story event')}</strong>
            <p>${escapeHTML(event.summary || '')}</p>
          </div>
        </li>
      `).join('')}
    </ol>
  `;
}

export function renderCalender() {
  const root = document.querySelector('#app-calender');
  if (!root) return;

  const timeline = validTimeline();
  const today = todayKey();

  const firstDate = timeline[0]?.date || today;
  const lastDate = timeline[timeline.length - 1]?.date || today;
  const months = monthRange(firstDate, lastDate);
  const dates = new Set(timeline.map(item => item.date));

  const selected = root.dataset.selectedDate || firstDate;
  root.dataset.selectedDate = selected;

  const selectedMonth = selected.slice(0, 7);
  const selectedYear = Number(selected.slice(0, 4));

  const selectedLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(
    Number(selected.slice(0, 4)),
    Number(selected.slice(5, 7)) - 1,
    Number(selected.slice(8, 10))
  ));

  root.innerHTML = `
    <div class="ios-cal-app">
      <header class="ios-cal-top">
        <div class="ios-cal-toolbar">
          <button type="button" class="ios-cal-year" data-year-back>
            <span aria-hidden="true">‹</span>
            ${selectedYear}
          </button>

          <div class="ios-cal-actions">
            <span class="ios-cal-status" aria-label="${escapeHTML(TIME_ZONE)}">
              ${TIME_FORMAT.format(new Date())}
            </span>
          </div>
        </div>

        <h1>${escapeHTML(MONTH_FORMAT.format(
          new Date(
            Number(selectedMonth.slice(0, 4)),
            Number(selectedMonth.slice(5, 7)) - 1,
            1
          )
        ))}</h1>
      </header>

      <div class="ios-cal-weekdays">
        ${WEEKDAYS.map((day, i) => `
          <span class="${i >= 5 ? 'is-weekend' : ''}">${escapeHTML(day)}</span>
        `).join('')}
      </div>

      <div class="ios-cal-scroll">
        ${months.map(month => renderMonth(month, selected, dates)).join('')}

        <section class="ios-cal-schedule">
          <h2>Schedule</h2>
          <p class="ios-cal-selected-date">${escapeHTML(selectedLabel)}</p>
          ${renderSchedule(selected, timeline)}
        </section>
      </div>

      <nav class="ios-cal-tabbar" aria-label="Calendar navigation">
        <button type="button" data-calendar-today>Today</button>
        <span>Calendars</span>
        <span>Inbox</span>
      </nav>
    </div>
  `;

  if (root.dataset.calendarEventsBound === 'true') return;
  root.dataset.calendarEventsBound = 'true';

  root.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const dateButton = target.closest('[data-calendar-date]');

    if (dateButton) {
      const date = dateButton.dataset.calendarDate;
      root.dataset.selectedDate = date;
      setDate(date);
      renderCalender();
      return;
    }

    if (target.closest('[data-calendar-today]')) {
      root.dataset.selectedDate = today;
      setDate(today);
      renderCalender();

      root.querySelector(`[data-month="${today.slice(0, 7)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (target.closest('[data-year-back]')) {
      const currentYear = Number(root.dataset.selectedDate.slice(0, 4));
      const previousYear = months.find(m => m.year < currentYear);

      if (previousYear) {
        const date = `${previousYear.year}-12-31`;
        const firstInYear = timeline.find(item =>
          item.date.startsWith(String(previousYear.year))
        );

        if (firstInYear) {
          root.dataset.selectedDate = firstInYear.date;
          setDate(firstInYear.date);
          renderCalender();
          root.querySelector(`[data-month="${firstInYear.date.slice(0, 7)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });
}

let unsubscribeStore = null;

export function initCalender() {
  const root = document.querySelector('#app-calender');
  if (!root) return;

  registerApp('calender', {
    root,
    render: renderCalender,
  });

  renderCalender();

  if (!unsubscribeStore) {
    unsubscribeStore = onStoreChange(renderCalender);
  }
}
