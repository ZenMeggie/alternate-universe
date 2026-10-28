import { $, ui, setHidden } from "./utils.js";
import { state, currentStory } from "./state.js";

export function showPanel(name) {
  state.panel = name;
  const hasStory = !!currentStory();
  setHidden($("character-panel"), name !== "characters");
  setHidden($("data-panel"), name !== "data");
  setHidden(ui.editor, !(name === "stories" && hasStory));
  setHidden(ui.empty, !(name === "stories" && !hasStory));
  document.querySelectorAll("[data-open-data]").forEach(b => b.classList.toggle("active", name === "data" && b.dataset.openData === state.dataKey));
}
