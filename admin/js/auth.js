import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "./firebase.js";
import { $, ui, setHidden, showError } from "./utils.js";
import { loadStories } from "./stories.js";
import { loadCharacters } from "./characters.js";
import { renderDataNav } from "./data-panel.js";

onAuthStateChanged(auth, async user => {
  if (!user) {
    ui.user.textContent = "";
    setHidden(ui.loginPanel, false); setHidden(ui.adminPanel, true); setHidden(ui.logout, true);
    return;
  }
  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (!adminDoc.exists() || adminDoc.data().role !== "admin") {
      await signOut(auth);
      setHidden(ui.loginPanel, false);
      showError(ui.loginError, new Error("Akun ini belum terdaftar sebagai admin. Tambahkan UID ke koleksi admins."));
      return;
    }
    setHidden(ui.loginPanel, true); setHidden(ui.adminPanel, false); setHidden(ui.logout, false);
    ui.user.textContent = user.email || user.uid;
    renderDataNav();
    await loadCharacters();
    await loadStories();
  } catch (error) {
    await signOut(auth);
    setHidden(ui.loginPanel, false);
    showError(ui.loginError, error);
  }
});

ui.loginForm.addEventListener("submit", async event => {
  event.preventDefault(); ui.loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch (error) { showError(ui.loginError, error); }
});
ui.logout.addEventListener("click", () => signOut(auth));
