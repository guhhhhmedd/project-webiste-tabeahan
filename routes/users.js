const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Middleware 
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Multer config 
const storageBukti = multer.diskStorage({
destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "public", "uploads", "bukti");
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

// Daftar paket valid 
const PAKET_LIST = [
  { key: "Paket SKD/TKD",        label: "Paket SKD/TKD",        durasi: 90  },
  { key: "Paket Akademik Polri",  label: "Paket Akademik Polri",  durasi: 90  },
  { key: "Paket PPPK",            label: "Paket PPPK",            durasi: 120 },
];

function buildPaymentMap(payments) {
  const map = {};
  for (const p of payments) {
    // Key-nya unik berdasarkan Paket + Nomor TO
    const key = `${p.paket}_${p.nomor_to}`;
    // Simpan objeknya (karena sudah ORDER BY created_at DESC, yang pertama dapet adalah yang terbaru)
    if (!map[key]) map[key] = p; 
  }
  return map;
}

// dashboard 
router.get("/dashboard", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.send(`<script>alert('Ujian sedang berlangsung!');window.location.href='/ujian/soal';</script>`);
    }

    const [payments] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users 
      WHERE status_ujian = 'SELESAI' 
      ORDER BY skor DESC, id ASC
      LIMIT 10
    `);

    const myRank = rankingRows.findIndex(r => r.username === user.username) + 1;

    res.render("users/dashboard", {
      user,
      payments,
      paymentMap: buildPaymentMap(payments),
      rankings: rankingRows.slice(0, 5),
      myRank: myRank > 0 ? myRank : "-",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan.");
  }
});

// dashboardPembayaranUjian 
router.get("/users/dashboardPembayaranUjian", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    let user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.send(`<script>alert('Ujian sedang berlangsung!');window.location.href='/ujian/soal';</script>`);
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

    // Cari ranking user
    const myRank = rankingRows.findIndex(r => r.username === user.username) + 1;

    const [riwayatUjian] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC",
      [userId]
    );

    res.render("users/dashboardPembayaranUjian", {
      user,
      paketList: PAKET_LIST,
      paymentMap: paymentMap,
      rankings: rankingRows,
      myRank: myRank > 0 ? myRank : "-",
      riwayatUjian: riwayatUjian,
      uploadError: req.query.uploadError ? decodeURIComponent(req.query.uploadError) : null,
      successMsg: req.query.success ? decodeURIComponent(req.query.success) : null,
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Terjadi kesalahan sistem.");
  }
});

// Ganti 'upload' jadi 'uploadBukti'
router.post("/upload-bukti", isLogin, uploadBukti.single('bukti'), async (req, res) => {
  const { paket_pilihan, nomor_to } = req.body;
  const userId = req.session.user.id;
  
  // Pastikan ambil nama filenya aja buat disimpen di DB
  const buktiFilename = req.file ? req.file.filename : null;

  if (!buktiFilename) {
    return res.redirect("/users/dashboardPembayaranUjian?uploadError=" + encodeURIComponent("File bukti transfer wajib diunggah!"));
  }

  try {
    // Simpan ke tabel payments dengan nomor_to-nya
    await db.query(
      `INSERT INTO payments (user_id, paket, nomor_to, bukti_transfer, status) 
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [userId, paket_pilihan, nomor_to, buktiFilename]
    );

    res.redirect("/users/dashboardPembayaranUjian?success=" + encodeURIComponent("Bukti terupload! Admin akan segera memverifikasi."));
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menyimpan data.");
  }
});

//  POST /deleteAccount 
router.post("/deleteAccount", isLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [userId]
    );

    payments.forEach((p) => {
  if (p.bukti_transfer) {
    // Langsung tembak dari root project
    const filePath = path.join(process.cwd(), "public", "uploads", "bukti", p.bukti_transfer);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM users WHERE id = ?", [userId]);

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
