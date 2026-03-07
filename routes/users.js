const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// ─────────────────────────────────────────────
// MULTER — upload bukti transfer
// ─────────────────────────────────────────────
const storageBukti = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "public", "uploads", "bukti");
    // Buat folder kalau belum ada
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = req.session.user?.id || "anon";
    cb(null, `bukti-${userId}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadBukti = multer({
  storage: storageBukti,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Hanya file JPG/PNG yang diizinkan!"));
  },
});

// ─────────────────────────────────────────────
// DAFTAR PAKET (hardcoded — sync dengan paket_ujian di DB)
// ─────────────────────────────────────────────
const PAKET_LIST = [
  { key: "Paket SKD/TKD",       label: "Paket SKD/TKD",       durasi: 90  },
  { key: "Paket Akademik Polri", label: "Paket Akademik Polri", durasi: 90  },
  { key: "Paket PPPK",           label: "Paket PPPK",           durasi: 120 },
];

// ─────────────────────────────────────────────
// HELPER: Bangun paymentMap dari array payments
// Key: "NamaPaket_nomor_to" → ambil yang terbaru (ORDER BY created_at DESC)
// Status di-UPPER agar konsisten dengan pengecekan di EJS
// ─────────────────────────────────────────────
function buildPaymentMap(payments) {
  const map = {};
  for (const p of payments) {
    const key = `${p.paket}_${p.nomor_to}`;
    if (!map[key]) {
      map[key] = {
        ...p,
        status: p.status ? p.status.toUpperCase() : "KOSONG",
      };
    }
  }
  return map;
}

// ─────────────────────────────────────────────
// GET /dashboard
// Landing page setelah login — redirect ke ujian kalau sedang ujian
// ─────────────────────────────────────────────
router.get("/dashboard", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    // Kalau sedang ujian, langsung ke halaman soal
    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.redirect("/ujian/soal/1");
    }

    const [payments] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users
      WHERE skor > 0 AND skor IS NOT NULL
      ORDER BY skor DESC, id ASC
      LIMIT 10
    `);

    const myRank = rankingRows.findIndex(r => r.username === user.username) + 1;

    res.render("users/dashboard", {
      user,
      payments,
      paymentMap: buildPaymentMap(payments),
      rankings:   rankingRows.slice(0, 5),
      myRank:     myRank > 0 ? myRank : "-",
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
});

// ─────────────────────────────────────────────
// GET /dashboardPembayaranUjian
// Halaman utama pilih TO + upload bukti bayar
// ─────────────────────────────────────────────
router.get("/dashboardPembayaranUjian", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    // Kalau sedang ujian, langsung ke halaman soal (jangan terjebak di dashboard)
    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.redirect("/ujian/soal/1");
    }

    const [paymentRows] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    const paymentMap = buildPaymentMap(paymentRows);

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users
      WHERE skor > 0 AND skor IS NOT NULL
      ORDER BY skor DESC, id ASC
      LIMIT 5
    `);

    const myRank = rankingRows.findIndex(r => r.username === user.username) + 1;

    const [riwayatUjian] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC",
      [userId]
    );

    res.render("users/dashboardPembayaranUjian", {
      user,
      paketList:    PAKET_LIST,
      paymentMap,
      rankings:     rankingRows,
      myRank:       myRank > 0 ? myRank : "-",
      riwayatUjian,
      uploadError:  req.query.uploadError ? decodeURIComponent(req.query.uploadError) : null,
      successMsg:   req.query.success    ? decodeURIComponent(req.query.success)     : null,
    });
  } catch (err) {
    console.error("Dashboard Pembayaran Error:", err);
    res.status(500).send("Terjadi kesalahan sistem.");
  }
});

// ─────────────────────────────────────────────
// POST /upload-bukti
// Upload bukti transfer untuk TO tertentu
// ─────────────────────────────────────────────
router.post("/upload-bukti", isLogin, uploadBukti.single("bukti"), async (req, res) => {
  const { paket_pilihan, nomor_to } = req.body;
  const userId        = req.session.user.id;
  const buktiFilename = req.file ? req.file.filename : null;

  if (!buktiFilename) {
    return res.redirect(
      "/dashboardPembayaranUjian?uploadError=" +
        encodeURIComponent("File bukti transfer wajib diunggah!")
    );
  }

  if (!paket_pilihan || !nomor_to) {
    return res.redirect(
      "/dashboardPembayaranUjian?uploadError=" +
        encodeURIComponent("Data paket atau nomor TO tidak valid.")
    );
  }

  // Validasi paket ada di PAKET_LIST
  const paketValid = PAKET_LIST.find(p => p.key === paket_pilihan);
  if (!paketValid) {
    return res.redirect(
      "/dashboardPembayaranUjian?uploadError=" +
        encodeURIComponent("Paket tidak dikenali.")
    );
  }

  try {
    // Cek apakah sudah ada payment aktif (PENDING/LUNAS) untuk TO ini
    const [existing] = await db.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ?
         AND UPPER(status) IN ('PENDING', 'LUNAS')`,
      [userId, paket_pilihan, nomor_to]
    );

    if (existing.length > 0) {
      // Hapus file yang baru diupload karena tidak jadi dipakai
      if (req.file) {
        const fp = path.join(process.cwd(), "public", "uploads", "bukti", buktiFilename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent(`TO #${nomor_to} sudah memiliki pembayaran aktif atau sedang diproses.`)
      );
    }

    // Simpan ke tabel payments
    await db.query(
      `INSERT INTO payments (user_id, paket, nomor_to, bukti_transfer, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [userId, paket_pilihan, parseInt(nomor_to), buktiFilename]
    );

    res.redirect(
      "/dashboardPembayaranUjian?success=" +
        encodeURIComponent("Bukti berhasil diupload! Admin akan memverifikasi dalam 1×24 jam.")
    );
  } catch (err) {
    console.error("Upload Bukti Error:", err);
    res.status(500).send("Gagal menyimpan data.");
  }
});

// ─────────────────────────────────────────────
// POST /deleteAccount
// Hapus akun sendiri beserta semua data
// ─────────────────────────────────────────────
router.post("/deleteAccount", isLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Hapus file bukti transfer dari storage
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [userId]
    );

    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(
          process.cwd(), "public", "uploads", "bukti", p.bukti_transfer
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    // Hapus semua data user
    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM riwayat_ujian WHERE user_id = ?",   [userId]);
    await db.query("DELETE FROM payments WHERE user_id = ?",         [userId]);
    await db.query("DELETE FROM users WHERE id = ?",                 [userId]);

    req.session.destroy((err) => {
      if (err) return res.redirect("/dashboard");
      res.clearCookie("connect.sid");
      res.redirect("/register?message=Akun+Anda+berhasil+dihapus+permanen");
    });
  } catch (err) {
    console.error("ERROR HAPUS AKUN:", err);
    res.status(500).send("Gagal menghapus akun, hubungi admin.");
  }
});

module.exports = router;