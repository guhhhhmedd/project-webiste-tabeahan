# 📘 Project Ujian CAT Web - Tabeahan Cendekia

Aplikasi simulasi ujian CAT (Computer Assisted Test) yang mendukung berbagai jenis paket ujian seperti SKD/TKD, Akademik POLRI, dan PPPK dengan sistem penilaian dinamis.

## 🚀 Fitur Utama (Update Terbaru)
- **Sistem Scoring Dinamis:** Mendukung poin 1-5 (khusus soal TKP/PPPK).
- **Passing Grade:** Kalkulasi kelulusan otomatis berdasarkan ambang batas subtes.
- **Fitur Pembahasan:** Peserta dapat melihat kunci dan penjelasan jawaban setelah ujian.
- **Manajemen Admin:** Verifikasi pembayaran, reset ujian, dan pengelolaan soal.
- **Timer Real-time:** Batasan waktu sesuai dengan paket ujian yang dipilih.

---

## 🛠️ Stack Teknologi
- **Backend:** Node.js, Express.js
- **Frontend:** EJS (Embedded JavaScript Templates), Tailwind CSS
- **Database:** MySQL (menggunakan `mysql2/promise`)
- **Session:** express-session
- **File Upload:** Multer

---

## 💻 Cara Menjalankan Project (Local Setup)

### 1️⃣ Clone Repository
```bash
git clone [https://github.com/username/nama-repo.git](https://github.com/username/nama-repo.git)
cd nama-repo
2️⃣ Install Dependencies
Bash
npm install
3️⃣ Setup Database MySQL
Pastikan MySQL sudah berjalan, lalu buat database baru:

SQL
CREATE DATABASE db_pencatatan;
4️⃣ Import Database (Versi Terbaru)
Import file database.sql yang ada di root folder ke database yang baru dibuat. File ini sudah mencakup tabel:

users (dengan sistem role & status ujian)

questions (dengan field skor_a-e & pembahasan)

materi_list (kategori subtes)

payments (log pembayaran & token)

jawaban_peserta & riwayat_ujian

Jalankan via terminal:

Bash
mysql -u root -p db_pencatatan < database.sql
5️⃣ Konfigurasi Environment (.env)
Buat file .env di root project dan isi sesuai konfigurasi database kamu:

Cuplikan kode
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_pencatatan
DB_PORT=3306
SESSION_SECRET=tabeahan_secret_key_123
PORT=3000
6️⃣ Jalankan Aplikasi
Mode Produksi:

Bash
npm start
Mode Development (Auto-restart):

Bash
npm run dev
📂 Struktur Penting
app.js → Titik masuk utama aplikasi.

routes/ → Logika routing (auth, admin, ujian, dashboard).

views/ → Template tampilan (EJS).

public/uploads/bukti/ → Lokasi penyimpanan bukti transfer peserta.

config/db.js → Koneksi pool database.

📝 Aturan Penilaian (Revisi Terbaru)
SKD/TKD: - TWK & TIU: Benar 5, Salah 0.

TKP: Skala 1 - 5 poin per opsi.

Perangkingan: Total Skor > TKP > TIU > TWK.

POLRI: Benar 1, Salah 0. (Lulus minimal 75%).

PPPK: Teknis (5 poin), Manajerial/Soskul/Wawancara (1-4 poin).

⚠ Troubleshooting
Error: Unknown column 'pembahasan' → Pastikan kamu sudah menjalankan query ALTER TABLE questions ADD COLUMN pembahasan TEXT; atau import database terbaru.

Gambar Tidak Muncul → Cek folder public/uploads/, pastikan permission folder tersebut bisa dibaca dan ditulis.

Session Hilang → Pastikan SESSION_SECRET di .env sudah terisi.

👨‍💻 Developer
Project ini dikembangkan untuk sistem simulasi ujian Tabeahan Cendekia.


---

### Tips buat kamu, Le:
1. **File database.sql:** Sebelum kamu `git push`, pastiin file `database.sql` di folder project kamu itu hasil **Export terbaru** dari MySQL kamu (yang sudah ada kolom `pembahasan` dan kolom `skor_a` sampe `skor_e`).
2. **Folder Upload:** Kadang folder `public/uploads/bukti` nggak ke-upload ke Git kalau kosong. Biar ke-upload, masukin file kosong namanya `.gitkeep` di dalam folder itu.