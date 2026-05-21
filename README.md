# 📘 Project Ujian CAT Web - Tabeahan Cendekia

Aplikasi simulasi ujian CAT (Computer Assisted Test) untuk latihan online paket SKD/TKD, Akademik POLRI, dan PPPK.

## 🚀 Fitur Utama
- **Sistem penilaian dinamis** untuk berbagai jenis soal.
- **Passing grade otomatis** berdasarkan ambang batas subtest.
- **Pembahasan jawaban** ditampilkan setelah ujian selesai.
- **Dashboard admin** untuk verifikasi pembayaran, reset ujian, dan manajemen soal.
- **Timer real-time** sesuai durasi paket ujian.

---

## 🛠️ Teknologi
- **Backend:** Node.js, Express.js
- **Template:** EJS
- **Database:** MySQL (`mysql2/promise`)
- **Session:** express-session
- **Upload file:** Multer

---

## 💻 Cara Menjalankan
1. Clone repository
```bash
git clone https://github.com/username/nama-repo.git
cd nama-repo
```

2. Install dependencies
```bash
npm install
```

3. Siapkan database MySQL
```sql
CREATE DATABASE db_pencatatan;
```

4. Import skema dan data awal
```bash
mysql -u root -p db_pencatatan < database.sql
```

5. Buat file `.env` di root project dan isi konfigurasi:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_pencatatan
DB_PORT=3306
SESSION_SECRET=tabeahan_secret_key_123
PORT=3000
```

6. Jalankan aplikasi
- Mode produksi:
  ```bash
  npm start
  ```
- Mode development (auto-restart):
  ```bash
  npm run dev
  ```

---

## 📂 Struktur Penting
- `app.js` — Entry point aplikasi.
- `routes/` — Route handler untuk `auth`, `admin`, `users`, dan `ujian`.
- `views/` — Template EJS untuk tampilan.
- `public/` — Asset statis dan folder upload.
- `config/db.js` — Koneksi database.
- `database.sql` — Skema tabel dan seed data dasar.

---

## 📝 Ringkasan Fitur
- `routes/auth.js` — Login, register, dan otentikasi.
- `routes/admin.js` — Manajemen peserta, pembayaran, dan soal.
- `routes/users.js` — Dashboard peserta, pembayaran, dan profil.
- `routes/ujian.js` — Logika ujian, hasil, dan review soal.

---

## ✅ Aturan Penilaian
- **Paket SKD/TKD**
  - TWK & TIU: benar 5, salah 0.
  - TKP: skala 1–5 per jawaban.
- **Paket Akademik Polri**
  - Hitung dengan persentase minimal 70%.
- **Paket PPPK**
  - Penilaian perkategori, lebih ke sistem peringkat.

---

## ⚠️ Troubleshooting
- `Unknown column 'pembahasan'` → pastikan database sudah diimport dari `database.sql` terbaru atau tambahkan kolom `pembahasan` pada tabel `questions`.
- Gambar tidak muncul → pastikan folder `public/uploads/` dapat ditulis dan dibaca.
- Session hilang → periksa `SESSION_SECRET` di `.env`.

---

## 💡 Tips
1. Jika folder `public/uploads/bukti` kosong, tambahkan `.gitkeep` agar folder tetap ikut di-repo.
2. Pastikan `database.sql` yang kamu gunakan sudah terbaru dan memiliki kolom `pembahasan` serta `skor_a` sampai `skor_e`.

---

## 👨‍💻 Developer
Project ini dibuat untuk sistem simulasi ujian Tabeahan Cendekia.
