# 📘 Project Ujian CAT Web

Aplikasi ujian berbasis web menggunakan:

* Node.js
* Express
* EJS
* MySQL
* mysql2
* express-session
* multer

---

# 🚀 Cara Menjalankan Project (Local Setup)

Ikuti langkah berikut untuk menjalankan project di komputer kamu.

---

## 1️⃣ Clone Repository

```bash
git clone https://github.com/username/nama-repo.git
cd nama-repo
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Setup Database MySQL

Pastikan MySQL sudah terinstall dan berjalan.

Masuk ke MySQL:

```bash
mysql -u root -p
```

Buat database:

```sql
CREATE DATABASE namadb;
EXIT;
```

---

## 4️⃣ Import File Database

Pastikan file `database.sql` ada di folder project.

Jalankan:

```bash
mysql -u root -p namadb < database.sql
```

Jika berhasil, semua tabel akan otomatis dibuat.

---

## 5️⃣ Buat File `.env`

Di root project, buat file bernama:

```
.env
```

Isi dengan konfigurasi berikut:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=namadb
DB_PORT=3306
SESSION_SECRET=secret123
```

Sesuaikan jika menggunakan user/password berbeda.

---

## 6️⃣ Jalankan Project

Untuk menjalankan aplikasi:

```bash
npm start
```

Atau untuk mode development:

```bash
npm run dev
```

---

## 🌐 Akses Aplikasi

Buka browser dan akses:

```
http://localhost:3000
```

---

# ⚠ Troubleshooting

### ❌ Error: Unknown database

Pastikan database sudah dibuat:

```sql
CREATE DATABASE namadb;
```

### ❌ Access denied for user

Pastikan username & password MySQL benar.

---

# 📂 Struktur Penting

* `app.js` → file utama aplikasi
* `config/` → konfigurasi database
* `routes/` → routing aplikasi
* `views/` → template EJS
* `public/` → file static (css, image, upload)

---

# 👨‍💻 Developer

Project ini dibuat untuk pembelajaran dan pengembangan aplikasi ujian berbasis web.

---

🔥 Jika ada kendala saat setup, pastikan semua langkah sudah diikuti dengan benar.
