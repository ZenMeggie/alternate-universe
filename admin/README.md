# Story CMS (HTML/CSS/JavaScript + Firebase)

## Isi
- `index.html`, `admin.css`, `js/`: admin dashboard.
- `firestore.rules`: rules Firestore.
- `storage.rules`: rules Firebase Storage.

## Setup
1. Sajikan folder `admin/` melalui web server lokal, misalnya Laragon.
2. Pastikan konfigurasi Firebase di `js/config.js` mengarah ke project yang sama dengan website.
3. Di Firebase Authentication, aktifkan provider Email/Password dan buat akun admin.
4. Salin UID akun admin dari Authentication.
5. Di Firestore, buat dokumen `admins/{UID}` dengan field:
   - `role` (string): `admin`
6. Terapkan isi `firestore.rules` pada Firestore Rules dan `storage.rules` pada Storage Rules.
7. Jalankan melalui local web server (contoh Live Server/Laragon). Jangan membuka halaman memakai `file://`.
8. Buka `/admin/` (atau `/admin/index.html`), masuk menggunakan akun admin.

## Struktur Firestore
```text
admins/{uid}
  role: "admin"

stories/{storyId}
  title, subtitle, description, coverUrl, status, createdAt, updatedAt

stories/{storyId}/chapters/{chapterId}
  part, title, subtitle, location, locationLat, locationLng, date, pov, alignment, status, order, createdAt, updatedAt

stories/{storyId}/chapters/{chapterId}/blocks/{blockId}
  type, order, text, alignment
  # opsional sesuai jenis:
  character, src, alt, storagePath, chatId, messageId, messages[], callText

characters/{characterId}, chats/{chatId}, messages/{messageId},
stickers/{stickerId}, narrations/{narrationId}, notes/{noteId},
photos/{photoId}, places/{placeId}, posts/{postId}, xdms/{dmId},
follows/{followId}, timeline/{dayId}, music/{musicId}, settings/story
```

Admin memiliki kategori editor terpisah untuk semua koleksi tersebut. ID dokumen baru dibuat otomatis dengan awalan kategori (misalnya `msg-...`, `note-...`, `day-...`) dan tetap stabil setelah disimpan, sehingga referensi antar data tidak berubah. Metadata global situs diedit di kategori “Pengaturan cerita”. Saat bab berstatus Published atau Coming Soon disimpan, tanggal, part, judul, subtitle, dan lokasi beserta koordinat peta disinkronkan ke satu hari timeline. Lokasi bab menjadi sumber cuaca ponsel. Event timeline tetap bisa ditambah dan diedit satu per satu di kategori “Timeline cerita”.

Untuk input WhatsApp, buat percakapan terlebih dahulu di “Chat & grup”, lalu pilih percakapan di “Pesan WhatsApp”. Admin dapat melihat preview bubble seperti layar percakapan WhatsApp, memilih sudut pandang anggota chat, dan mengeklik bubble untuk mengeditnya. Tombol “Tambah beberapa pesan” menerima satu pesan per baris; gunakan format `Nama: pesan` untuk menentukan pengirim otomatis, lalu periksa preview sebelum menyimpan.

Lagu yang menjadi bagian dari Stories ditambahkan melalui blok musik pada isi bab/part. Lagu untuk perpustakaan karakter diunggah melalui kategori “Musik karakter”; pilih karakter, judul, dan file audio, lalu simpan sebagai Terbit agar muncul pada tab karakter di aplikasi Music. Kedua sumber playlist tetap terpisah.

## Tipe blok
- `heading`, `location`, `paragraph`, `italic`: pakai `text`.
- `dialogue`: `character`, `text`.
- `image`: `src`, `alt`, `storagePath`.
- `chat`: `character`, `messages` (array objek `{sender, text}`), opsional `chatId` dan `messageId`.
- `call`: `character`, `callText`.

## Penting untuk renderer website
Website ponsel membaca koleksi konten dari Firestore, termasuk timeline dan metadata pada `settings/story`. Koleksi konten dapat dibaca publik, tetapi hanya akun yang terdaftar di `admins/{UID}` yang boleh mengubahnya. Cerita panjang tetap memfilter `status == "published"` untuk pembaca publik.

Firestore tidak menghapus subcollection otomatis. Tombol hapus cerita pada dashboard ini menghapus blok dan bab satu per satu sebelum menghapus dokumen cerita. Gambar Storage yang diunggah perlu dibersihkan terpisah jika ingin menghapus semua file terkait.

## Catatan security
- Jangan mengizinkan user membuat/mengubah dokumen di `admins`.
- `allow read: if true` pada `story-media` membuat file cerita yang sudah diunggah dapat dibaca publik; ini cocok untuk gambar publik pada website cerita.
- Untuk produksi, pertimbangkan memvalidasi field/schema pada rules dan membatasi upload lebih lanjut.
