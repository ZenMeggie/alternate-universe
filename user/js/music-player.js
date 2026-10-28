const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.8;

let playlist = [];
let currentIndex = -1;
let playlistId = '';
let error = '';
let lastTimeUpdate = -1;
let lastVolume = audio.volume;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(getMusicState());
    } catch (caught) {
      console.error('Music player listener failed', caught);
    }
  });
}

function currentTrack() {
  return playlist[currentIndex] || null;
}

export function getMusicState() {
  const track = currentTrack();
  return {
    url: track?.url || '',
    title: track?.title || '',
    artist: track?.artist || '',
    playlistId,
    playing: !audio.paused && !audio.ended,
    paused: audio.paused,
    currentTime: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    volume: audio.volume,
    muted: audio.muted || audio.volume === 0,
    hasPrevious: currentIndex > 0,
    hasNext: currentIndex >= 0 && currentIndex < playlist.length - 1,
    error,
  };
}

export function onMusicChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const track = currentTrack();
  navigator.mediaSession.metadata = track && 'MediaMetadata' in window
    ? new MediaMetadata({ title: track.title || 'Story music', artist: track.artist || 'Same Time Next Year' })
    : null;
  navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      });
    } catch (caught) {
      console.warn('Unable to update media position', caught);
    }
  }
}

async function playCurrent() {
  if (!currentTrack()) return;
  error = '';
  try {
    await audio.play();
  } catch (caught) {
    error = caught?.name === 'NotAllowedError'
      ? 'Ketuk tombol putar untuk memulai lagu.'
      : 'Lagu gagal diputar. Periksa URL dan format file audio.';
    emit();
    throw caught;
  }
}

export function setMusicPlaylist(tracks, { autoplay = false, id = '', startUrl = '' } = {}) {
  const next = (tracks || []).filter((track) => track?.url);
  const requestedIndex = startUrl ? next.findIndex((track) => track.url === startUrl) : 0;
  const nextIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const sameTrack = currentTrack()?.url === next[nextIndex]?.url;
  playlist = next;
  playlistId = id;
  currentIndex = next.length ? nextIndex : -1;
  if (!next.length) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    playlistId = id;
    error = '';
    updateMediaSession();
    emit();
    return;
  }
  const track = currentTrack();
  if (!sameTrack) {
    audio.pause();
    audio.src = track.url;
    audio.load();
  }
  updateMediaSession();
  emit();
  if (autoplay && !sameTrack) playCurrent().catch(() => {});
  else if (autoplay && audio.paused) playCurrent().catch(() => {});
}

export async function toggleMusic(url = '', title = '') {
  if (url && currentTrack()?.url !== url) {
    const queueIndex = playlist.findIndex((track) => track.url === url);
    if (queueIndex >= 0) currentIndex = queueIndex;
    else {
      playlist = [{ url, title }];
      currentIndex = 0;
      playlistId = 'single';
    }
    audio.pause();
    audio.src = url;
    audio.load();
    error = '';
  }
  if (!currentTrack()) return;
  if (audio.paused) await playCurrent();
  else {
    audio.pause();
    error = '';
  }
  updateMediaSession();
  emit();
}

export function seekMusic(value) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, Number(value) || 0));
  updateMediaSession();
  emit();
}

export function setMusicVolume(value) {
  const volume = Math.max(0, Math.min(1, Number(value) || 0));
  audio.volume = volume;
  audio.muted = false;
  if (volume > 0) lastVolume = volume;
  emit();
}

export function toggleMusicMute() {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    audio.volume = lastVolume || 0.8;
  } else {
    lastVolume = audio.volume;
    audio.muted = true;
  }
  emit();
}

export async function skipMusic(direction) {
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= playlist.length) return;
  currentIndex = nextIndex;
  const track = currentTrack();
  audio.pause();
  audio.src = track.url;
  audio.load();
  error = '';
  updateMediaSession();
  emit();
  await playCurrent();
}

audio.addEventListener('play', () => {
  error = '';
  updateMediaSession();
  emit();
});
for (const event of ['pause', 'loadedmetadata', 'durationchange', 'error']) {
  audio.addEventListener(event, () => {
    if (event === 'error') error = 'Lagu gagal dimuat. Pastikan URL mengarah langsung ke file audio.';
    updateMediaSession();
    emit();
  });
}
audio.addEventListener('ended', () => {
  if (currentIndex < playlist.length - 1) {
    skipMusic(1).catch((caught) => console.warn('Unable to play next playlist track', caught));
    return;
  }
  updateMediaSession();
  emit();
});
audio.addEventListener('timeupdate', () => {
  const second = Math.floor(audio.currentTime);
  if (second === lastTimeUpdate) return;
  lastTimeUpdate = second;
  updateMediaSession();
  emit();
});

if ('mediaSession' in navigator) {
  const actions = {
    play: () => playCurrent().catch(() => {}),
    pause: () => audio.pause(),
    stop: () => audio.pause(),
    seekto: (details) => { if (Number.isFinite(details.seekTime)) seekMusic(details.seekTime); },
    seekbackward: () => seekMusic(audio.currentTime - 10),
    seekforward: () => seekMusic(audio.currentTime + 10),
    previoustrack: () => skipMusic(-1).catch(() => {}),
    nexttrack: () => skipMusic(1).catch(() => {}),
  };
  for (const [action, handler] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (caught) {
      console.warn(`Media action "${action}" is unavailable`, caught);
    }
  }
}
