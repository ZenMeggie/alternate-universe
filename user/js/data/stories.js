// ---------- Helper penulisan cerita (supaya tiap baris cukup 1 baris) ----------
// align (opsional): 'left' | 'center' | 'right' | 'justify'
const h = (text, align) => ({ type: 'heading', text, ...(align && { align }) });
const loc = (text, align) => ({ type: 'location', text, ...(align && { align }) });
const p = (text, align) => ({ type: 'paragraph', text, ...(align && { align }) });
const it = (text, align) => ({ type: 'italic', text, ...(align && { align }) });
const img = (src, alt) => ({ type: 'image', src, alt });
const call = (character) => ({ type: 'call', character, text: `${character} Calling...` });

// Banyak paragraf sekaligus: ...ps('a', 'b', 'c')
const ps = (...texts) => texts.map((t) => p(t));

// Dialog: eve('...') / bianca('...')
const speaker = (character) => (text, align) => ({
  type: 'dialogue',
  character,
  text,
  ...(align && { align }),
});
const eve = speaker('Eve');
const bianca = speaker('Bianca');

// Link ke pesan WhatsApp. ownerId diambil dari awalan messageId ("eve-en3" -> "eve")
const wa = (chatId, messageId) => ({ app: 'whatsapp', chatId, messageId });

// Blok chat: chat('Noe', wa(...), 'pesan 1', 'pesan 2')
const chat = (character, link, ...texts) => ({
  type: 'chat',
  character,
  messages: texts.map((text) => ({ sender: character, text })),
  link,
});

const EVE_NOE = 'chat-eve-noela';

// ---------- Cerita ----------
export const stories = [
  {
    id: 'part-1-museum',
    part: 1,
    title: 'Orang yang Sama',
    subtitle: 'Bandung, 16.42 WIB',
    date: '2026-10-21',
    align: 'justify', // default perataan satu bab; bisa ditimpa per blok
    pov: 'Eve',       // tokoh sudut pandang: pesan dari pov tampil di kanan (hijau), lainnya di kiri (putih)
    content: [
      ...ps(
        'Museum itu tidak terlalu ramai sore itu.',
        'Beberapa pengunjung berjalan melewati ruang pameran, sebagian berhenti untuk membaca keterangan karya, sementara yang lain sibuk mengambil foto. Di sudut ruangan, seorang perempuan berdiri cukup lama di depan sebuah lukisan.',
        'Namanya Evellyn Theodor.',
        'Mahasiswa semester lima Arsitektur itu sedang memperhatikan bagaimana cahaya dari jendela jatuh ke permukaan lukisan. Entah sudah berapa menit ia berdiri di sana. Tasnya menggantung di satu bahu, rambutnya sedikit berantakan, dan ponselnya terus bergetar sejak tadi.',
        'Eve mengabaikannya.',
        'Ponselnya bergetar lagi.',
        'Ia akhirnya melirik layar.'
      ),
      chat('Noe', wa(EVE_NOE, 'eve-en3'), 'kak', 'kak eve', 'pinjem duit dong'),
      it('Eve membalas tanpa mengubah ekspresi.'),
      chat('Eve', wa(EVE_NOE, 'eve-en4'), 'buat apa'),
      p('Balasan datang cepat.'),
      chat('Noe', wa(EVE_NOE, 'eve-en5'), 'rahasia'),
      chat('Eve', wa(EVE_NOE, 'eve-en6'), 'nggak'),
      chat('Noe', wa(EVE_NOE, 'eve-en7'), 'PELIT BANGET JADI ORANG'),
      it('Eve memasukkan ponselnya kembali ke tas.'),
      ...ps(
        'Setidaknya, ada satu hal yang tidak pernah berubah sejak ia masih berseragam putih abu-abu: Noela Theodor selalu punya cara untuk mengganggu ketenangannya.',
        'Eve kembali menatap lukisan di hadapannya.'
      ),
      img('assets/photos/the_kiss.png', 'The Kiss karya Gustav Klimt'),

      bianca('Emang niat banget, ya, emasnya.'),
      p('Eve menoleh sedikit.'),
      eve('Hmm?'),
      bianca('Lukisannya. Kalau bukan Klimt, mungkin udah dibilang kemahalan pakai cat.'),
      p('Eve menatap lukisan itu lagi.'),
      eve('Untung dia Klimt.'),
      p('Perempuan itu tertawa kecil. Bukan tawa yang dibuat-buat, cuma reaksi spontan karena jawaban Eve ternyata lumayan lucu.'),
      bianca('Bener juga.'),
      p('Hening sebentar. Mereka kembali memperhatikan lukisan tersebut.'),
      bianca('Gue suka bagian emasnya. Apalagi kalau dilihat langsung. Di foto tuh rasanya beda.'),
      p('Eve mengangguk.'),
      eve('Karena pantulan cahayanya. Emas yang dia pakai juga bukan sekadar cat warna emas.'),
      bianca('Iya, pakai gold leaf, kan?'),
      eve('Iya.'),
      p('Perempuan itu mengangguk pelan, kembali mengamati lukisan.'),
      bianca('Gue pernah baca, kebiasaan dia pakai emas juga ada pengaruh dari bapaknya yang pengrajin emas. Terus perjalanan dia ke Ravenna juga ngaruh ke gaya lukisnya.'),
      p('Eve meliriknya sebentar.'),
      eve('Banyak baca, ya.'),
      bianca('Anak seni. Masa nggak tahu.'),
      eve('Oh.'),
      p('Perempuan itu menoleh, seolah menunggu tambahan komentar. Namun, Eve malah kembali menatap lukisan.'),
      bianca('...Lo emang irit ngomong, ya?'),
      eve('Katanya museum tempat yang bagus buat refleksi.'),
      bianca('Refleksi diri?'),
      eve('Bukan. Refleksi cahaya.'),
      p('Perempuan itu terdiam sesaat sebelum terkekeh.'),
      bianca('Oke. Garing.'),
      eve('Gue nggak minta penilaian.'),
      p('Belum sempat perempuan itu membalas, ponsel Eve kembali bergetar. Kali ini bukan pesan, melainkan panggilan telepon.'),
      call('Noe'),
      ...ps(
        'Eve menatap layar dengan ekspresi seseorang yang baru saja menerima kabar bahwa kiamat ditunda, tetapi harus mengurus administrasinya sendiri.',
        'Dia menolak panggilan itu.',
        'Ponselnya berdering lagi.',
        'Ditolak.',
        'Berdering lagi.',
        'Perempuan di sampingnya melirik sekilas.'
      ),
      bianca('Penting banget, kayaknya.'),
      eve('Enggak.'),
      bianca('Angkat aja. Siapa tahu darurat.'),
      p('Eve akhirnya menerima panggilan itu.'),
      eve('Apa?'),
      ...ps(
        'Suara dari seberang langsung terdengar nyaring sampai perempuan di sebelahnya bisa menangkap beberapa kata yang tidak jelas.',
        'Eve menjauhkan ponsel dari telinga.'
      ),
      eve('Noe. Gue lagi di museum.'),
      p('Jeda.'),
      eve('Terus?'),
      p('Jeda lagi. Eve memejamkan mata.'),
      eve('Ya Allah, Noe.'),
      p('Panggilan berakhir. Eve menurunkan ponselnya, menarik napas panjang, lalu memasukkannya ke tas.'),
      bianca('Kenapa?'),
      eve('Belum tahu. Dia kalau telepon biasanya antara butuh bantuan atau mau bikin masalah.'),
      bianca('Bedanya?'),
      eve('Kalau butuh bantuan, dia bikin masalah dulu.'),
      p('Perempuan itu tertawa lagi, kali ini sedikit lebih lepas.'),
      p('Eve hanya membetulkan posisi tasnya, lalu melihat jam.'),
      eve('Gue harus pergi.'),
      bianca('Oh. Oke.'),
      ...ps(
        'Eve mengangguk kecil. Tidak ada perkenalan, tidak ada pertukaran nama, apalagi permintaan akun Instagram. Dia hanya berjalan pergi setelah sempat melirik lukisan itu sekali lagi.',
        'Perempuan tersebut kembali memandang The Kiss, tetapi pikirannya sudah sedikit teralihkan.',
        'Ada sesuatu dari wajah perempuan tadi yang terasa familiar.',
        'Entah pernah melihatnya di kampus, di suatu acara, atau di tempat lain. Dia belum bisa mengingatnya.',
        'Akhirnya, dia membuka sketchbook yang dibawanya. Namun, alih-alih menggambar, tangannya malah meraih ponsel.'
      ),
    ],
  },

  // Bab kosong: cukup 1 baris tiap bab
  { id: 'part-2', part: 2, title: 'Recognition', subtitle: 'Wajah yang terasa familiar', date: null, content: [] },
  { id: 'part-3', part: 3, title: 'The Search', subtitle: 'Sedikit rasa penasaran', date: null, content: [] },
  { id: 'part-4', part: 4, title: 'Another Encounter', subtitle: 'Bertemu lagi', date: null, content: [] },
  { id: 'part-5', part: 5, title: 'Same Time Next Year', subtitle: 'To be continued', date: null, content: [] },
];

export const getStory = (id) => stories.find((s) => s.id === id) || null;