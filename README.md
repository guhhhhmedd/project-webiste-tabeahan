# 📘 Ujian CAT Web — Tabeahan Cendekia

Aplikasi simulasi ujian **CAT (Computer Assisted Test)** yang mendukung berbagai jenis paket ujian seperti SKD/TKD, Akademik POLRI, dan PPPK, lengkap dengan sistem penilaian dinamis dan passing grade otomatis.

---

## 🚀 Fitur Utama

| Fitur | Deskripsi |
|---|---|
| **Scoring Dinamis** | Mendukung bobot poin 1–5 per opsi (khusus soal TKP/PPPK). |
| **Passing Grade** | Kalkulasi kelulusan otomatis berdasarkan ambang batas per subtes. |
| **Pembahasan Jawaban** | Peserta bisa melihat kunci & penjelasan jawaban setelah ujian selesai. |
| **Manajemen Admin** | Verifikasi pembayaran, reset ujian, dan pengelolaan soal per paket/TO. |
| **Timer Real-time** | Batas waktu dihitung dari server sesuai durasi paket yang dipilih. |

---

## 🛠️ Stack Teknologi

- **Backend** — Node.js, Express.js
- **Frontend** — EJS (Embedded JavaScript Templates), Tailwind CSS
- **Database** — MySQL (`mysql2/promise`)
- **Session** — express-session
- **Upload File** — Multer

---

## 💻 Cara Menjalankan Project (Local Setup)

### 1. Clone Repository

```bash
git clone https://github.com/username/nama-repo.git
cd nama-repo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Database MySQL

Pastikan MySQL sudah berjalan, lalu buat database baru:

```sql
CREATE DATABASE db_pencatatan;
```

### 4. Import Database

Import file `database.sql` (ada di root folder) ke database yang baru dibuat. File ini sudah mencakup tabel:

- `users` — akun peserta & admin, termasuk role dan status ujian
- `questions` — soal, opsi, bobot skor A–E, dan pembahasan
- `materi_list` — kategori/subtes per paket
- `payments` — log pembayaran & token ujian
- `jawaban_peserta` & `riwayat_ujian` — jawaban dan riwayat hasil ujian

```bash
mysql -u root -p db_pencatatan < database.sql
```

### 5. Konfigurasi Environment (`.env`)

Buat file `.env` di root project:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_pencatatan
DB_PORT=3306
SESSION_SECRET=tabeahan_secret_key_123
PORT=3000
```

### 6. Jalankan Aplikasi

Mode produksi:

```bash
npm start
```

Mode development (auto-restart):

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000` (atau sesuai `PORT` di `.env`).

---

## 📂 Struktur Project

```
.
├── app.js                    # Titik masuk utama aplikasi
├── config/
│   └── db.js                 # Koneksi pool database
├── routes/                   # Logika routing (auth, admin, ujian, dashboard)
├── views/                    # Template tampilan (EJS)
├── public/
│   └── uploads/
│       └── bukti/            # Penyimpanan bukti transfer peserta
└── database.sql              # Skema & data awal database
```

---

## 📝 Aturan Penilaian

**Paket SKD/TKD**
- TWK & TIU — Benar `+5`, Salah `0`
- TKP — skala `1–5` poin per opsi
- Perangkingan: **Total Skor → TKP → TIU → TWK**

**Paket Akademik POLRI**
- Benar `+1`, Salah `0`
- Lulus minimal `75%`

**Paket PPPK**
- Teknis — `5` poin per jawaban benar
- Manajerial / Sosial-Kultural / Wawancara — skala `1–4` poin per opsi

---

## ⚠️ Troubleshooting

| Masalah | Solusi |
|---|---|
| `Error: Unknown column 'pembahasan'` | Jalankan `ALTER TABLE questions ADD COLUMN pembahasan TEXT;` atau import ulang `database.sql` versi terbaru. |
| Gambar tidak muncul | Cek folder `public/uploads/`, pastikan permission-nya bisa dibaca & ditulis. |
| Session hilang / logout terus | Pastikan `SESSION_SECRET` di `.env` sudah terisi. |

---

## 📌 Catatan Sebelum Push

- **`database.sql`** — pastikan file ini hasil export **terbaru** dari MySQL lokal kamu (sudah termasuk kolom `pembahasan` dan `bobot_a`–`bobot_e`), supaya siapa pun yang clone project dapat skema yang sinkron dengan kode.
- **Folder upload kosong** — Git tidak melacak folder kosong. Tambahkan file `.gitkeep` di dalam `public/uploads/bukti/` supaya folder tersebut ikut ter-push meski belum ada isinya.

---

## 👨‍💻 Developer

Project ini dikembangkan untuk sistem simulasi ujian **Tabeahan Cendekia**.