// Incoming call — iPhone 17 style:
//   ring → avatar with pulsing rings, caller name, decline/accept
//   live → mute/keypad/speaker grid + red end button, timer in island
// Web Audio ringtone (no external file needed).
import { getMessage, getCharacter, getNarration, avatarHtml } from '../data/store.js';
import { registerAction } from '../navigation.js';
import { esc, $ } from '../utils.js';

let el     = null;
let tick   = null;
let call   = null; // { m, who, phase:'ring'|'live'|'ended', sec, total, minimized, muted, speaker }
let audioCtx = null;
let ringNodes = []; // oscillator + gain nodes for the ringtone

/* ── helpers ─────────────────────────────────────────────────── */
const clock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

const sv = (body, s = 28) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const IC = {
  mute:     sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>'),
  keypad:   sv('<circle cx="6" cy="5" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="18" cy="5" r="1.2"/><circle cx="6" cy="11" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="18" cy="11" r="1.2"/><circle cx="6" cy="17" r="1.2"/><circle cx="12" cy="17" r="1.2"/><circle cx="18" cy="17" r="1.2"/><circle cx="12" cy="22" r="1.2"/>'),
  speaker:  sv('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  add:      sv('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0M19 3v5M16.5 5.5h5"/>'),
  video:    sv('<rect x="3" y="6" width="12" height="12" rx="2.5"/><path d="M15 10.5l6-3.5v10l-6-3.5"/>'),
  contacts: sv('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17a4 4 0 0 1 8 0"/>'),
  hang:     sv('<path d="M3 14c4.5-4.5 13.5-4.5 18 0l-2.5 2.5-3.5-1.5v-2.5c-2-.7-4-.7-6 0V15l-3.5 1.5z" fill="currentColor" stroke="none"/>', 32),
  accept:   sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z" fill="currentColor" stroke="none"/>', 30),
};

/* ── ringtone (Web Audio API, no file) ───────────────────────── */
function startRing() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Classic iPhone tri-tone: 3 short beeps every 2s
    function beep() {
      if (!audioCtx || call?.phase !== 'ring') return;
      [0, 0.22, 0.44].forEach((offset) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type      = 'sine';
        osc.frequency.value = 1046.5; // C6

        const t = audioCtx.currentTime + offset;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.start(t);
        osc.stop(t + 0.2);
        ringNodes.push(osc, gain);
      });

      if (call?.phase === 'ring') {
        // Repeat every 2 seconds
        const id = setTimeout(beep, 2000);
        ringNodes.push({ stop: () => clearTimeout(id) });
      }
    }
    beep();
  } catch { /* silently skip if no audio permission */ }
}

function stopRing() {
  ringNodes.forEach((n) => { try { n.stop?.(); } catch {} });
  ringNodes = [];
  try { audioCtx?.close(); } catch {}
  audioCtx = null;
}

/* ── haptic pattern ──────────────────────────────────────────── */
function vibrateRing() {
  if (!call || call.phase !== 'ring') return;
  navigator.vibrate?.([500, 1000]);
  if (call?.phase === 'ring') {
    const id = setTimeout(vibrateRing, 1500);
    ringNodes.push({ stop: () => clearTimeout(id) });
  }
}

/* ── state & event ───────────────────────────────────────────── */
function emit() {
  const screen = $('#phone-screen');
  const open = !!call && !call.minimized;
  if (screen) {
    if (open) screen.dataset.callOpen = '1';
    else delete screen.dataset.callOpen;
  }
  document.dispatchEvent(new CustomEvent('call:change', {
    detail: { live: call?.phase === 'live', minimized: !!call?.minimized, sec: call?.sec || 0 },
  }));
}

function close() {
  stopRing();
  clearInterval(tick);
  tick = null;
  el?.remove();
  el = null;
  call = null;
  emit();
}

function minimize() {
  if (!call || call.phase !== 'live' || call.minimized) return;
  call.minimized = true;
  el?.classList.add('is-min');
  emit();
}

function expand() {
  if (!call || !call.minimized) return;
  call.minimized = false;
  el?.classList.remove('is-min');
  emit();
}

/* ── markup ──────────────────────────────────────────────────── */
const gridBtn = (key, icon, label, on = false) =>
  `<button type="button" class="icall__b ${on ? 'is-on' : ''}" data-call="${key}" aria-pressed="${on}">
    <i>${icon}</i><span>${label}</span>
   </button>`;

function render() {
  if (!el || !call) return;
  const { m, who, phase } = call;
  const kind = m.callKind === 'video' ? 'video' : 'audio';
  const name = esc(who?.name || 'Unknown');

  // ── RINGING ────────────────────────────────────────────────
  if (phase === 'ring') {
    // Build a blurred avatar background from the character avatar
    const avatarUrl = who?.avatar || who?.photoURL || '';
    const bgStyle   = avatarUrl
      ? `style="background-image:url('${avatarUrl}')"`
      : '';

    el.innerHTML = `
      <!-- blurred background from avatar -->
      <div class="icall__bg" ${bgStyle}></div>
      <div class="icall__bg-overlay"></div>

      <!-- top: caller info -->
      <div class="icall__top">
        <p class="icall__app">${esc(kind === 'video' ? 'FaceTime Video' : 'WhatsApp Audio')}</p>
        <h2>${name}</h2>
        <p class="icall__status">incoming ${kind} call</p>
      </div>

      <!-- centre: avatar with pulsing rings -->
      <div class="icall__avatar-wrap" aria-hidden="true">
        <div class="icall__pulse icall__pulse--3"></div>
        <div class="icall__pulse icall__pulse--2"></div>
        <div class="icall__pulse icall__pulse--1"></div>
        <div class="icall__avatar-circle">
          ${avatarHtml(who, 110)}
        </div>
      </div>

      <!-- hint: story can't be declined -->
      <p class="icall__hint" id="call-hint" hidden>
        In this story the call was answered — swipe to decline is disabled.
      </p>

      <!-- bottom: slide to answer (iOS style) -->
      <div class="icall__actions">
        <div class="icall__action">
          <button type="button" class="icall__round icall__round--red" data-call="decline" aria-label="Decline">
            ${IC.hang}
          </button>
          <span>Decline</span>
        </div>
        <div class="icall__action">
          <button type="button" class="icall__round icall__round--green" data-call="accept" aria-label="Accept">
            ${IC.accept}
          </button>
          <span>Accept</span>
        </div>
      </div>`;
    return;
  }

  // ── LIVE / ENDED ───────────────────────────────────────────
  const note     = m.narrationId ? getNarration(m.narrationId) : null;
  const noteText = note?.text || note?.body || '';

  el.innerHTML = `
    <div class="icall__top">
      <h2>${name}</h2>
      <p class="icall__status" id="call-time">
        ${phase === 'ended' ? `Call ended · ${clock(call.sec)}` : clock(call.sec)}
      </p>
    </div>

    ${noteText
      ? `<div class="icall__note"><small>Story note</small><p>${esc(noteText)}</p></div>`
      : '<div class="icall__spacer"></div>'}

    <div class="icall__grid">
      ${gridBtn('mute',    IC.mute,     'mute',     call.muted)}
      ${gridBtn('noop',    IC.keypad,   'keypad')}
      ${gridBtn('speaker', IC.speaker,  'speaker',  call.speaker)}
      ${gridBtn('noop',    IC.add,      'add call')}
      ${gridBtn('noop',    IC.video,    'FaceTime')}
      ${gridBtn('noop',    IC.contacts, 'contacts')}
    </div>

    <button type="button" class="icall__round icall__round--red icall__end" data-call="end" aria-label="End call">
      ${IC.hang}
    </button>`;
}

function finish() {
  if (!call || call.phase === 'ended') return;
  clearInterval(tick);
  tick  = null;
  call.phase     = 'ended';
  call.minimized = false;
  el?.classList.remove('is-min');
  render();
  emit();
  setTimeout(close, 1400);
}

function connect() {
  stopRing();
  call.phase = 'live';
  call.sec   = 0;
  render();
  emit();
  tick = setInterval(() => {
    call.sec += 1;
    const label = el && $('#call-time', el);
    if (label) label.textContent = clock(call.sec);
    emit();
    if (call.total && call.sec >= call.total) finish();
  }, 1000);
}

function onClick(e) {
  const b   = e.target.closest('[data-call]');
  if (!b || !call) return;
  const act = b.dataset.call;
  if (act === 'accept') {
    connect();
  } else if (act === 'decline') {
    b.classList.remove('is-shake');
    void b.offsetWidth;
    b.classList.add('is-shake');
    const hint = $('#call-hint', el);
    if (hint) hint.hidden = false;
    navigator.vibrate?.(60);
  } else if (act === 'end') {
    finish();
  } else if (act === 'mute' || act === 'speaker') {
    const key = act === 'mute' ? 'muted' : 'speaker';
    call[key] = !call[key];
    b.classList.toggle('is-on');
    b.setAttribute('aria-pressed', String(b.classList.contains('is-on')));
  }
}

export function showCall(id) {
  if (call) { expand(); return; }
  const m      = getMessage(id);
  const screen = $('#phone-screen');
  if (!m || !screen) return;

  el = document.createElement('div');
  el.className = 'icall';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Incoming call');
  el.addEventListener('click', onClick);
  screen.appendChild(el);

  call = {
    m,
    who:       getCharacter(m.senderId),
    phase:     'ring',
    sec:       0,
    total:     Number(m.duration) || 0,
    minimized: false,
    muted:     false,
    speaker:   false,
  };

  render();
  emit();
  startRing();
  vibrateRing();
}

/* ── injected CSS (scoped, no file needed) ───────────────────── */
function injectStyle() {
  if (document.getElementById('icall-style')) return;
  const s = document.createElement('style');
  s.id = 'icall-style';
  s.textContent = `
/* ── incoming call overlay ── */
.icall {
  position: absolute; inset: 0; z-index: 40;
  display: flex; flex-direction: column; align-items: center;
  padding: calc(var(--sb-h, 58px) + 18px) 28px calc(var(--home-h, 34px) + 28px);
  box-sizing: border-box;
  color: #fff; overflow: hidden;
  /* slide-up entrance */
  animation: icall-in .38s cubic-bezier(.22,1,.36,1) both;
}
@keyframes icall-in {
  from { transform: translateY(60px); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.icall.is-min {
  transform: scale(.9) translateY(-16px);
  opacity: 0;
  pointer-events: none;
  transition: transform .32s ease, opacity .22s ease;
}

/* blurred avatar background */
.icall__bg {
  position: absolute; inset: 0; z-index: 0;
  background-color: #2a3545;
  background-size: cover; background-position: center;
  filter: blur(40px) brightness(.55) saturate(1.4);
  transform: scale(1.15); /* hide blur edge artefacts */
}
/* dark overlay to ensure readability */
.icall__bg-overlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(0,0,0,.38) 0%,
    rgba(0,0,0,.15) 40%,
    rgba(0,0,0,.50) 100%
  );
}
/* all children above the bg layers */
.icall > *:not(.icall__bg):not(.icall__bg-overlay) { position: relative; z-index: 2; }

/* caller info */
.icall__top { text-align: center; width: 100%; }
.icall__app { margin: 0 0 4px; font-size: 15px; font-weight: 500; opacity: .8; }
.icall__top h2 {
  margin: 0; font-size: 38px; font-weight: 700; letter-spacing: -.5px;
  text-shadow: 0 2px 12px rgba(0,0,0,.3);
}
.icall__status {
  margin: 6px 0 0; font-size: 16px; opacity: .72;
  font-variant-numeric: tabular-nums; text-transform: lowercase;
}

/* ── avatar with pulse rings ── */
.icall__avatar-wrap {
  position: relative; display: grid; place-items: center;
  margin: auto 0; /* push down with spacer above/below */
  width: 140px; height: 140px; flex-shrink: 0;
}
.icall__pulse {
  position: absolute; inset: 0; border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,.32);
  animation: icall-pulse 2.4s ease-out infinite;
}
.icall__pulse--1 { animation-delay: 0s; }
.icall__pulse--2 { animation-delay: .6s; }
.icall__pulse--3 { animation-delay: 1.2s; }
@keyframes icall-pulse {
  0%   { transform: scale(1);    opacity: .65; }
  80%  { transform: scale(2.0);  opacity: 0;   }
  100% { transform: scale(2.0);  opacity: 0;   }
}
.icall__avatar-circle {
  position: relative; z-index: 1;
  width: 116px; height: 116px; border-radius: 50%; overflow: hidden;
  box-shadow: 0 8px 36px rgba(0,0,0,.45), 0 0 0 3px rgba(255,255,255,.18);
}
.icall__avatar-circle .avatar {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
  display: block;
}
/* fallback monogram */
.icall__avatar-circle .avatar--mono {
  display: grid; place-items: center;
  background: linear-gradient(135deg, #4a7fb5, #2d5486);
  font-size: 44px; font-weight: 700;
}

/* hint text */
.icall__hint {
  margin: 0 0 12px; font-size: 13px; opacity: .72;
  text-align: center; max-width: 280px;
}

/* ── bottom action buttons ── */
.icall__actions {
  display: flex; justify-content: space-between; align-items: flex-start;
  width: 100%; max-width: 280px;
}
.icall__action {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.icall__action > span {
  font-size: 14px; font-weight: 500; opacity: .88;
  text-shadow: 0 1px 6px rgba(0,0,0,.25);
}

/* round action buttons */
.icall__round {
  border: 0; border-radius: 50%; width: 76px; height: 76px;
  display: grid; place-items: center; color: #fff; cursor: pointer;
  transition: transform .12s ease, filter .12s ease;
  box-shadow: 0 4px 18px rgba(0,0,0,.35);
}
.icall__round:active { transform: scale(.91); filter: brightness(.88); }
.icall__round--red   {
  background: radial-gradient(circle at 38% 32%, #ff6459, #ff3b30);
}
.icall__round--green {
  background: radial-gradient(circle at 38% 32%, #56d97a, #34c759);
}
.icall__round.is-shake { animation: icall-shake .4s; }
@keyframes icall-shake {
  0%,100% { transform: translateX(0); }
  25%     { transform: translateX(-8px); }
  75%     { transform: translateX(8px); }
}

/* ── live call ── */
.icall__spacer { flex: 1; }
.icall__note {
  width: 100%; margin: 22px 0 auto; max-height: 34%; overflow: auto;
  padding: 12px 14px; border-radius: 18px;
  background: rgba(255,255,255,.13);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: .5px solid rgba(255,255,255,.14);
  box-sizing: border-box;
}
.icall__note small {
  display: block; opacity: .6; font-size: 11px;
  text-transform: uppercase; letter-spacing: .07em; margin-bottom: 4px;
}
.icall__note p { margin: 0; font-size: 14px; line-height: 1.45; white-space: pre-wrap; }

.icall__grid {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 22px 0; width: 100%; margin: 22px 0 26px;
}
.icall__b {
  background: none; border: 0; color: #fff;
  display: grid; justify-items: center; gap: 7px;
  font: 500 12px var(--ios-font, -apple-system,system-ui,sans-serif);
  cursor: pointer;
}
.icall__b i {
  width: 66px; height: 66px; border-radius: 50%;
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  display: grid; place-items: center;
  transition: background .15s, color .15s;
}
.icall__b.is-on i  { background: #fff; color: #111; }
.icall__b:active i { background: rgba(255,255,255,.30); }
.icall__end { margin: 0 auto; }

/* status bar overrides during call */
[data-call-open] .statusbar { color: #fff; position: relative; z-index: 50; }
.statusbar.has-call #sb-time,
.statusbar.has-call #sb-ind { visibility: hidden; }

/* dynamic island call state */
.phone__island { transition: width .32s cubic-bezier(.22,1,.36,1); }
.phone__island.is-call {
  width: 200px !important;
  pointer-events: auto !important; cursor: pointer; z-index: 60;
}
.phone__island.is-call .phone__lens { opacity: 0; }
.isl-call__ico, .isl-call__time {
  display: none; position: absolute; top: 50%;
  transform: translateY(-50%); color: #30d158;
}
.isl-call__ico  { left: 14px; line-height: 0; }
.isl-call__time {
  right: 14px;
  font: 600 13px/1 -apple-system, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}
.phone__island.is-call .isl-call__ico,
.phone__island.is-call .isl-call__time { display: block; }
`;
  document.head.appendChild(s);
}

export function initCalls() {
  injectStyle();
  registerAction('open-call',   (target) => showCall(target.dataset.id));
  registerAction('call-resume', ()       => expand());
  document.addEventListener('phone:home', minimize);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !call) return;
    if (call.phase === 'live')  minimize();
    else if (call.phase === 'ring') close();
  });
}
