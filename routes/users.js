const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Middleware proteksi
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// Konfigurasi multer bukti pembayaran
const storageBukti = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/bukti/"),
  filename: (req, file, cb) => {
    const userId = req.session.user ? req.session.user.id : "anon";
    cb(null, `bukti-${userId}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadBukti = multer({
  storage: storageBukti,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG/PNG yang diizinkan!"));
    }
  },
});

// GET /dashboard
router.get("/dashboard", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.send(`<script>alert('Ujian sedang berlangsung!');window.location.href='/ujian/soal';</script>`);
    }

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users 
      WHERE status_ujian = 'SELESAI' 
      ORDER BY skor DESC, id ASC
    `);

    const [paketList] = await db.query(
      "SELECT * FROM paket_ujian WHERE is_active = 1"
    );

    const myRank = rankingRows.findIndex((r) => r.username === user.username) + 1;

    res.render("users/dashboard", {
      user,
      rankings: rankingRows.slice(0, 5),
      myRank: myRank > 0 ? myRank : "-",
      uploadError: req.query.uploadError || null,
      paketList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan, silakan coba lagi.");
  }
});

// POST /users/upload-bukti
router.post(
  "/users/upload-bukti",
  isLogin,
  (req, res, next) => {
    uploadBukti.single("bukti")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res.redirect("/dashboard?uploadError=File terlalu besar! Maksimal 2MB.");
        return res.redirect("/dashboard?uploadError=Error upload file.");
      } else if (err) {
        return res.redirect(`/dashboard?uploadError=${err.message}`);
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file)
      return res.redirect("/dashboard?uploadError=Mohon pilih file terlebih dahulu.");
    try {
      const userId = req.session.user.id;
      await db.query(
        "INSERT INTO payments (user_id, bukti_transfer, status) VALUES (?, ?, 'PENDING')",
        [userId, req.file.filename]
      );
      await db.query("UPDATE users SET status = 'PENDING', paket_pilihan = ? WHERE id = ?", [
        req.body.paket_pilihan,
        userId,
      ]);
      res.redirect("/dashboard");
    } catch (err) {
      console.error(err);
      res.redirect("/dashboard?uploadError=Gagal upload, silakan coba lagi.");
    }
  }
);

// POST /deleteAccount
router.post("/deleteAccount", isLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [userId]
    );

    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(__dirname, "../public/uploads/bukti/", p.bukti_transfer);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM users WHERE id = ?", [userId]);

    req.session.destroy((err) => {
      if (err) return res.redirect("/dashboard");
      res.clearCookie("connect.sid");
      res.redirect("/register?message=Akun Anda berhasil dihapus permanen");
    });
  } catch (err) {
    console.error("ERROR HAPUS AKUN:", err);
    res.status(500).send("Gagal menghapus akun, hubungi admin.");
  }
});

module.exports = router;
