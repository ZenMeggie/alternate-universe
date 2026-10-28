
export const narrations = [
  {
    id: "nar-en3-eve",
    characterId: "eve",
    timestamp: "2026-10-21T16:35:30+07:00",
    text:
      "Noe muncul lagi dengan permintaan uang tanpa penjelasan. Eve sudah tahu pola ini. Kalau dituruti, belum tentu masalahnya selesai; kalau ditolak, ponselnya akan lebih berisik.",
    related: {
      messageId: "eve-en3",
    },
  },
  {
    id: "nar-enc1-eve",
    characterId: "eve",
    timestamp: "2026-10-21T16:43:00+07:00",
    text:
      "Eve baru saja kembali menikmati suasana museum ketika Noe menelepon berkali-kali. Ia belum tahu masalah apa yang sedang dihadapi adiknya, tetapi sudah bisa membayangkan sore yang tenang itu akan berakhir lebih cepat.",
    related: {
      messageId: "eve-enc1",
      eventId: "ev-museum",
    },
  },
  {
    id: "nar-museum-eve",
    characterId: "eve",
    timestamp: "2026-10-21T16:42:00+07:00",
    text:
      "Eve tidak datang ke museum untuk bertemu siapa pun. Ia hanya ingin menghabiskan waktu di depan karya yang disukainya, jauh dari urusan kuliah dan pesan-pesan Noe yang tidak pernah habis.",
    related: {
      eventId: "ev-museum",
    },
  },
  {
    id: "nar-museum-bia",
    characterId: "bia",
    timestamp: "2026-10-21T16:42:00+07:00",
    text:
      "Percakapan itu tidak panjang dan perempuan tadi bahkan tidak memperkenalkan diri. Namun, ada sesuatu pada wajahnya yang terasa familier. Bianca mencoba mengingatnya sepanjang perjalanan meninggalkan museum.",
    related: {
      eventId: "ev-bia-search",
    },
  },
];

export const getNarration = (id) =>
  narrations.find((narration) => narration.id === id) || null;
