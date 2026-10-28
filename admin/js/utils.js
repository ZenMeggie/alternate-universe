export const $ = (id) => document.getElementById(id);

export const ui = {
  loginPanel: $("login-panel"), adminPanel: $("admin-panel"), loginForm: $("login-form"),
  loginError: $("login-error"), logout: $("logout-btn"), user: $("user-label"),
  storyList: $("story-list"), newStory: $("new-story-btn"), empty: $("empty-state"),
  editor: $("editor"), storyForm: $("story-form"), chapterList: $("chapter-list"),
  chapterEditor: $("chapter-editor"), chapterForm: $("chapter-form"), blockList: $("block-list"),
  toast: $("toast")
};

let toastTimer;
export function notify(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}
export function showError(target, error) {
  target.textContent = error?.message || String(error);
}
export function setHidden(el, hidden) { el.classList.toggle("hidden", hidden); }
export function safeDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  return "";
}
export function statusLabel(status) {
  return status === "published" ? "Published" : status === "coming-soon" ? "Coming Soon" : "Draft";
}
export function slugId(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}
export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
export const stamp = ts => String(ts || "").slice(0, 16).replace("T", " ");
export const clip = (v, n = 40) => { const s = String(v || "").replace(/\s+/g, " "); return s.length > n ? s.slice(0, n) + "…" : s; };
