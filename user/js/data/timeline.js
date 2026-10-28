
export const timeline = [
  {
    date: "2026-10-21",
    label: "Day 1",
    title: "Orang yang Sama",
    summary:
      "Eve mengunjungi museum seperti biasa. Sebuah percakapan singkat di depan The Kiss mempertemukannya dengan Bianca, sebelum telepon dari Noe mengakhiri obrolan mereka.",
    events: [
      {
        id: "ev-museum",
        time: "16:42",
        title: "Di depan The Kiss",
        summary:
          "Eve dan Bianca bertukar komentar singkat tentang lukisan Gustav Klimt. Mereka belum berkenalan, tetapi Bianca merasa wajah Eve familier setelah perempuan itu pergi.",
      },
      {
        id: "ev-bia-search",
        time: "16:50",
        title: "Wajah yang familier",
        summary:
          "Bianca mencoba mengingat pernah melihat Eve di mana. Rasa penasaran membuatnya mulai mencari petunjuk melalui unggahan dan informasi kampus.",
      },
    ],
  },
];

export const storyDates = timeline.map((day) => day.date);

export const getDay = (date) =>
  timeline.find((day) => day.date === date) || null;

export const allEvents = timeline.flatMap((day) =>
  day.events.map((event) => ({
    ...event,
    date: day.date,
  })),
);

export const getEvent = (id) =>
  allEvents.find((event) => event.id === id) || null;
