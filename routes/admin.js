const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");

// Middleware proteksi admin
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.render("login", { error: "Hanya admin yang bisa masuk!", rateLimited: false, resetTime: null });
}

// Multer untuk Excel
const storageExcel = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/excel_temp/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadExcel = multer({ storage: storageExcel });

// DASHBOARD ADMIN
router.get("/dashboardAdmin", isAdmin, async (req, res) => {
  try {
    const [statsSoal] = await db.query(`
      SELECT TRIM(paket) AS paket, COUNT(*) AS total 
      FROM questions 
      GROUP BY TRIM(paket)
    `);

    const [daftarPaket] = await db.query("SELECT * FROM paket_ujian");

    const [users] = await db.query(`
      SELECT u.*, p.bukti_transfer 
      FROM users u
      LEFT JOIN (
        SELECT user_id, bukti_transfer 
        FROM payments 
        ORDER BY id DESC 
        LIMIT 1
      ) p ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    res.render("admin/dashboardAdmin", { statsSoal, daftarPaket, users });
  } catch (err) {
    console.error("Gagal di dashboardAdmin:", err);
    res.status(500).send("Gagal memuat data admin.");
  }
});

// DAFTAR PESERTA
router.get("/admin/daftarPeserta", isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.*, p.bukti_transfer 
      FROM users u
      LEFT JOIN (
        SELECT user_id, bukti_transfer 
        FROM payments 
        ORDER BY id DESC 
        LIMIT 1
      ) p ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);
    res.render("admin/daftarPeserta", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data peserta.");
  }
});

// VERIFIKASI & TOLAK PEMBAYARAN
router.get("/admin/verify/:id", isAdmin, async (req, res) => {
  const targetId = req.params.id;
  try {
    // Pakai crypto, bukan Math.random()
    const tokenBaru = crypto.randomBytes(4).toString("hex").toUpperCase();

    await db.query(
      "UPDATE users SET status = 'LUNAS', token_ujian = ? WHERE id = ?",
      [tokenBaru, targetId]
    );
    await db.query(
      "UPDATE payments SET status = 'LUNAS' WHERE user_id = ?",
      [targetId]
    );

    res.redirect("/admin/daftarPeserta");
  } catch (err) {
    console.error("ERROR VERIFIKASI:", err);
    res.status(500).send("Gagal verifikasi pembayaran.");
  }
});

router.get("/admin/reject/:id", isAdmin, async (req, res) => {
  const targetId = req.params.id;
  try {
    await db.query("UPDATE users SET status = 'DITOLAK' WHERE id = ?", [targetId]);
    await db.query("UPDATE payments SET status = 'DITOLAK' WHERE user_id = ?", [targetId]);
    res.redirect("/admin/daftarPeserta");
  } catch (err) {
    res.status(500).send("Gagal menolak verifikasi.");
  }
});

// SOAL — TAMBAH MANUAL
router.post("/admin/tambah-soal", isAdmin, async (req, res) => {
  const { paket, materi, soal, a, b, c, d, e, kunci } = req.body;
  try {
    await db.query(
      `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_nilai) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5)`,
      [paket, materi, soal, a, b, c, d, e, kunci]
    );
    res.redirect("/dashboardAdmin?message=Soal berhasil ditambah");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal tambah soal. Cek nama paket dan kolom database.");
  }
});

// SOAL — IMPORT EXCEL
router.post("/admin/upload-soal", isAdmin, uploadExcel.single("fileExcel"), async (req, res) => {
  if (!req.file) return res.status(400).send("File tidak ditemukan.");

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of rows) {
      await db.query(
        `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_nilai) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.paket, row.materi, row.soal, row.a, row.b, row.c, row.d, row.e, row.kunci, row.bobot || 5]
      );
    }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.redirect("/dashboardAdmin?message=Import Excel berhasil!");
  } catch (err) {
    console.error("ERROR IMPORT EXCEL:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).send("Gagal proses Excel. Pastikan format kolom: paket | materi | soal | a | b | c | d | e | kunci");
  }
});

// SOAL — KELOLA PER PAKET
router.get("/admin/kelola-soal/:paket", isAdmin, async (req, res) => {
  const namaPaket = req.params.paket;
  try {
    const [soalList] = await db.query(
      "SELECT * FROM questions WHERE TRIM(paket) = ? ORDER BY id DESC",
      [namaPaket]
    );
    res.render("admin/kelolaSoal", { paket: namaPaket, soalList });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil data soal.");
  }
});

// SOAL — EDIT & UPDATE
router.get("/admin/editSoal/:id", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.redirect("/dashboardAdmin");
    res.render("admin/editSoal", { s: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

router.post("/admin/updateSoal", isAdmin, async (req, res) => {
  const { id, paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci } = req.body;
  try {
    await db.query(
      `UPDATE questions 
       SET paket=?, materi=?, soal=?, opsi_a=?, opsi_b=?, opsi_c=?, opsi_d=?, opsi_e=?, kunci=? 
       WHERE id=?`,
      [paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, id]
    );
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal update soal.");
  }
});

// SOAL — HAPUS
router.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}?message=Soal berhasil dihapus`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menghapus soal.");
  }
});

// DURASI UJIAN
router.post("/admin/update-durasi", isAdmin, async (req, res) => {
  const { id, durasi } = req.body;
  try {
    await db.query("UPDATE paket_ujian SET durasi_menit = ? WHERE id = ?", [durasi, id]);
    res.redirect("/dashboardAdmin?message=Durasi berhasil diperbarui");
  } catch (err) {
    res.redirect("/dashboardAdmin?error=Gagal update durasi");
  }
});

// HAPUS AKUN DARI ADMIN
router.post("/deleteAccountFromAdmin", isAdmin, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).send("ID user tidak ditemukan!");
  }

  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [id]
    );

    for (const p of payments) {
      if (p.bukti_transfer) {
        const filePath = path.join(process.cwd(), "public/uploads/bukti/", p.bukti_transfer);
        
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.error("Gagal hapus file fisik:", fileErr);
        }
      }
    }

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [id]);
    await db.query("DELETE FROM users WHERE id = ?", [id]);

    res.redirect("/admin/daftarPeserta?success=Akun berhasil dihapus permanen");

  } catch (err) {
    console.error("Gagal hapus akun:", err);
    res.status(500).send("Database error: " + err.message);
  }
});
module.exports = router;
