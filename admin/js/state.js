// State bersama. Modul lain tidak bisa meng-assign `let` hasil import, jadi semua lewat objek `state`.
export const state = {
  stories: [],
  selectedStoryId: null,
  selectedChapterId: null,
  chapters: [],
  blocks: [],
  characters: [],
  selectedCharacterId: null,
  xAccounts: [],
  panel: "stories",
  dataKey: "messages",
};
export const cache = {}; // koleksi data ponsel yang sudah dimuat

export const currentStory = () => state.stories.find(s => s.id === state.selectedStoryId);
export const currentChapter = () => state.chapters.find(c => c.id === state.selectedChapterId);
