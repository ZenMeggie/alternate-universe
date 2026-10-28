import { startStore, onStoreChange } from './data/store.js';
import { initState } from './state.js';
import { initNavigation, registerAction, applyRoute, renderNav } from './navigation.js';
import { initHome, renderHome } from './home.js';
import { initLanding, renderLanding } from './landing.js';
import { initNotes } from './apps/notes.js';
import { initWhatsApp } from './apps/whatsapp.js';
import { initGallery } from './apps/gallery.js';
import { initTwitter } from './apps/twitter.js';
import { initStories } from './apps/stories.js';
import { initMusic } from './apps/music.js';
import { initPhone } from './phone/shell.js';
import { initSettingsApp } from './apps/settings.js';
import { initCalls } from './phone/call.js';
import { initLock } from './phone/lock.js';
import { initTransitions } from './phone/transitions.js';
import { initCalender, renderCalender } from './apps/calender.js';
import { initCalculator, renderCalculator } from './apps/calculator.js';
import { initFullscreen } from './phone/fullscreen.js';
import { initFit } from './phone/fit.js';
import { initSmoothScroll } from './phone/smooth-scroll.js';
import { initGestures } from './phone/gesture.js';

await startStore(); // tunggu semua koleksi terbaca dulu
initState();
initNavigation();
initHome();
initLanding();
initNotes(registerAction);
initWhatsApp(registerAction);
initGallery(registerAction);
initTwitter(registerAction);
initStories(registerAction);
initMusic(registerAction);
initCalculator();
initCalender();
initSettingsApp();
initPhone();
initLock();
initTransitions();
initCalls();
initFullscreen();
initFit();
initSmoothScroll();
initGestures();
applyRoute();

onStoreChange(() => {
  renderLanding();
  renderHome();
  renderNav();
  renderCalender();
  renderCalculator();
});

document.getElementById('app-loading')?.remove(); // opsional: loader di HTML