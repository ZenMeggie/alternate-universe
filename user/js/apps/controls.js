// Status tombol Control Center (pesawat, Wi-Fi, kecerahan, senter, dst). Disimpan ke localStorage.
const KEY = 'au-story:phone:v1';
const defaults = { airplane: false, cellular: true, wifi: true, bluetooth: true, orientation: false, flashlight: false, brightness: 1, volume: 0.6 };
const state = { ...defaults };
const subs = new Set();

try {
  Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {});
} catch {
  /* abaikan */
}
state.flashlight = false; // senter selalu mati saat dimuat

function save() {
  try {
    const { flashlight, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* storage nonaktif */
  }
}

export const getControls = () => state;
export const onControls = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export function setControl(key, value) {
  if (!(key in state) || state[key] === value) return;
  state[key] = value;
  save();
  subs.forEach((fn) => { try { fn(key); } catch (e) { console.error(e); } });
}

export function toggleControl(key) {
  if (key === 'airplane') {
    const on = !state.airplane;
    state.cellular = !on;
    state.wifi = !on;
    state.bluetooth = !on;
    setControl('airplane', on);
    return;
  }
  setControl(key, !state[key]);
}