const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Middleware ───────────────────────────────────────────
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// ─── Multer config ────────────────────────────────────────
const storageBukti = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/bukti/"),
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

// ─── Daftar paket valid ───────────────────────────────────
const PAKET_LIST = [
  { key: "Paket SKD/TKD",        label: "Paket SKD/TKD",        durasi: 90  },
  { key: "Paket Akademik Polri",  label: "Paket Akademik Polri",  durasi: 90  },
  { key: "Paket PPPK",            label: "Paket PPPK",            durasi: 120 },
];

// ─── Helper: build paymentMap dari array payments ─────────
// Kembalikan object { "Paket SKD/TKD": paymentObj, ... }
function buildPaymentMap(payments) {
  const map = {};
  for (const p of payments) {
    // Ambil yang terbaru per paket
    if (!map[p.paket]) map[p.paket] = p;
  }
  return map;
}

// ─── GET /dashboard ───────────────────────────────────────
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

// ─── GET /users/dashboardPembayaranUjian ──────────────────
router.get("/users/dashboardPembayaranUjian", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    let user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.send(`<script>alert('Ujian sedang berlangsung!');window.location.href='/ujian/soal';</script>`);
    }

    // ── Cek 30 hari setelah ujian selesai ──
    if (user.status_ujian === "SELESAI" && user.tgl_selesai_ujian) {
      const selesai = new Date(user.tgl_selesai_ujian);
      const diffDays = (Date.now() - selesai) / (1000 * 60 * 60 * 24);
      if (diffDays >= 30) {
        // Reset user — harus bayar lagi
        await db.query(
          "UPDATE users SET status_ujian = 'IDLE', skor = NULL, tgl_selesai_ujian = NULL WHERE id = ?",
          [userId]
        );
        // Expire semua payment LUNAS jadi EXPIRED
        await db.query(
          "UPDATE payments SET status = 'EXPIRED' WHERE user_id = ? AND status = 'LUNAS'",
          [userId]
        );
        user.status_ujian = "IDLE";
        user.skor = null;
        user.tgl_selesai_ujian = null;
      }
    }

    const [payments] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users 
      WHERE status_ujian = 'SELESAI' 
      ORDER BY skor DESC, id ASC
      LIMIT 5
    `);
    const myRank = rankingRows.findIndex(r => r.username === user.username) + 1;

    res.render("users/dashboardPembayaranUjian", {
      user,
      paketList: PAKET_LIST,
      paymentMap: buildPaymentMap(payments),
      rankings: rankingRows,
      myRank: myRank > 0 ? myRank : "-",
      uploadError: req.query.uploadError ? decodeURIComponent(req.query.uploadError) : null,
      successMsg: req.query.success ? decodeURIComponent(req.query.success) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan.");
  }
});

// ─── POST /users/upload-bukti ─────────────────────────────
router.post(
  "/users/upload-bukti",
  isLogin,
  (req, res, next) => {
    uploadBukti.single("bukti")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res.redirect("/users/dashboardPembayaranUjian?uploadError=File+terlalu+besar!+Maksimal+2MB.");
        return res.redirect("/users/dashboardPembayaranUjian?uploadError=Error+upload+file.");
      } else if (err) {
        return res.redirect(`/users/dashboardPembayaranUjian?uploadError=${encodeURIComponent(err.message)}`);
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file)
      return res.redirect("/users/dashboardPembayaranUjian?uploadError=Mohon+pilih+file+terlebih+dahulu.");

    const { paket_pilihan } = req.body;
    const userId = req.session.user.id;

    // Validasi paket
    const validPaket = PAKET_LIST.map(p => p.key);
    if (!paket_pilihan || !validPaket.includes(paket_pilihan)) {
      return res.redirect("/users/dashboardPembayaranUjian?uploadError=Pilih+paket+terlebih+dahulu.");
    }

    try {
      // Cek status payment terbaru untuk paket ini
      const [existing] = await db.query(
        `SELECT * FROM payments 
         WHERE user_id = ? AND paket = ? AND status IN ('PENDING', 'LUNAS') 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, paket_pilihan]
      );

      if (existing.length > 0) {
        const st = existing[0].status;
        if (st === "LUNAS") {
          // Hapus file yang baru diupload karena tidak dipakai
          fs.unlink(path.join("public/uploads/bukti/", req.file.filename), () => {});
          return res.redirect("/users/dashboardPembayaranUjian?uploadError=Anda+sudah+memiliki+akses+aktif+untuk+paket+ini.");
        }
        if (st === "PENDING") {
          fs.unlink(path.join("public/uploads/bukti/", req.file.filename), () => {});
          return res.redirect("/users/dashboardPembayaranUjian?uploadError=Pembayaran+paket+ini+masih+menunggu+verifikasi.");
        }
      }

      // Insert payment baru
      await db.query(
        "INSERT INTO payments (user_id, paket, bukti_transfer, status) VALUES (?, ?, ?, 'PENDING')",
        [userId, paket_pilihan, req.file.filename]
      );

      res.redirect(`/users/dashboardPembayaranUjian?success=${encodeURIComponent("Bukti pembayaran " + paket_pilihan + " berhasil dikirim! Menunggu verifikasi admin.")}`);
    } catch (err) {
      console.error(err);
      res.redirect("/users/dashboardPembayaranUjian?uploadError=Gagal+upload,+silakan+coba+lagi.");
    }
  }
);

// ─── POST /deleteAccount ──────────────────────────────────
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
      res.redirect("/register?message=Akun+Anda+berhasil+dihapus+permanen");
    });
  } catch (err) {
    console.error("ERROR HAPUS AKUN:", err);
    res.status(500).send("Gagal menghapus akun, hubungi admin.");
  }
});

module.exports = router;
