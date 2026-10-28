
export const stickers = [
  { id: "noe-annoyed", label: "Noe kesal", file: "assets/stickers/noe-annoyed.webp" },
  { id: "eve-deadpan", label: "Eve datar", file: "assets/stickers/eve-deadpan.webp" },
  { id: "bia-confused", label: "Bia bingung", file: "assets/stickers/bia-confused.webp" },
  { id: "theo-chaos", label: "Theo bikin ribut", file: "assets/stickers/theo-chaos.webp" },
];

export const getSticker = (id) =>
  stickers.find((sticker) => sticker.id === id) || null;
