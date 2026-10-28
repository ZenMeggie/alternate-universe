
const copyThread = (thread, ownerId) =>
  thread.map(({ narr, ...message }) => {
    const copy = { ...message, id: `${ownerId}-${message.id}` };
    if (narr?.[ownerId]) copy.narrationId = narr[ownerId];
    return copy;
  });

// Percakapan BAB 1: Eve dan Noela
// Bianca dan Eve belum bertukar kontak.
const eveNoeThread = [
  {
    id: "en1",
    senderId: "noela",
    timestamp: "2026-10-21T16:35:00+07:00",
    text: "kak",
    eventId: "ev-museum",
  },
  {
    id: "en2",
    senderId: "noela",
    timestamp: "2026-10-21T16:35:10+07:00",
    text: "kak eve",
    eventId: "ev-museum",
  },
  {
    id: "en3",
    senderId: "noela",
    timestamp: "2026-10-21T16:35:30+07:00",
    text: "pinjem duit dong",
    eventId: "ev-museum",
    narr: { eve: "nar-en3-eve" },
  },
  {
    id: "en4",
    senderId: "eve",
    timestamp: "2026-10-21T16:36:00+07:00",
    text: "buat apa?",
    eventId: "ev-museum",
  },
  {
    id: "en5",
    senderId: "noela",
    timestamp: "2026-10-21T16:36:10+07:00",
    text: "rahasia",
    eventId: "ev-museum",
  },
  {
    id: "en6",
    senderId: "eve",
    timestamp: "2026-10-21T16:36:20+07:00",
    text: "nggak",
    eventId: "ev-museum",
  },
  {
    id: "en7",
    senderId: "noela",
    timestamp: "2026-10-21T16:36:30+07:00",
    text: "PELIT BANGET JADI ORANG",
    eventId: "ev-museum",
  },
];

const eveNoelaCallThread = [
  {
    id: "enc1",
    senderId: "noela",
    timestamp: "2026-10-21T16:43:00+07:00",
    text: "KAK ANGKAT DULU",
    eventId: "ev-museum",
    narr: { eve: "nar-enc1-eve" },
  },
  {
    id: "enc2",
    senderId: "eve",
    timestamp: "2026-10-21T16:43:30+07:00",
    text: "Apa?",
    eventId: "ev-museum",
  },
  {
    id: "enc3",
    senderId: "noela",
    timestamp: "2026-10-21T16:43:40+07:00",
    text: "Kakak di mana?",
    eventId: "ev-museum",
  },
  {
    id: "enc4",
    senderId: "eve",
    timestamp: "2026-10-21T16:43:50+07:00",
    text: "Museum. Kenapa?",
    eventId: "ev-museum",
  },
];

export const chats = [
  {
    id: "chat-eve-noela",
    characterId: "eve",
    contactId: "noela",
    messages: [
      ...copyThread(eveNoeThread, "eve"),
      ...copyThread(eveNoelaCallThread, "eve"),
    ],
  },
  {
    id: "chat-noela-eve",
    characterId: "noela",
    contactId: "eve",
    messages: [
      ...copyThread(eveNoeThread, "noela"),
      ...copyThread(eveNoelaCallThread, "noela"),
    ],
  },
];
