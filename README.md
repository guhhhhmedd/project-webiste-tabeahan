## Cara Menjalankan Project
1. git clone ...
2. npm install     <!-- npm install untuk menginstal semua defendensi yang diperlukan untuk bisa menjalankan websitenya di local -->
3. Buat file .env
4. Buat database MySQL
5. npm start# 📘 Project Ujian CAT Web

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
CREATE DATABASE db_pencatatan;
EXIT;
```

---

## 4️⃣ Import File Database

Pastikan file `database.sql` ada di folder project.

Jalankan:

```bash
mysql -u root -p db_pencatatan < database.sql
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
DB_PASSWORD= password mysql kalian
DB_NAME=db_pencatatan
DB_PORT=3000
SESSION_SECRET=tabeahan-cendekia-secret
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

# 📂 Struktur Pentin

