const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// MIDDLEWARE
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

// MULTER — upload bukti transfer (SECURE VERSION)
const storageBukti = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "public", "uploads", "bukti");
    if (!fs.existsSync(uploadPath))
      fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = req.session.user?.id || "anon";
    const safeExt = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, `bukti-${userId}-${Date.now()}${safeExt}`);
  },
});

function validateImageFile(req, file, cb) {
  const allowedMime = ["image/jpeg", "image/png"];
  if (!allowedMime.includes(file.mimetype)) {
    return cb(new Error("Hanya file JPG/PNG yang diizinkan!"));
  }
  const originalName = file.originalname.toLowerCase();
  const parts = originalName.split(".");
  if (parts.length !== 2) {
    return cb(
      new Error("Nama file tidak valid! Jangan gunakan double extension."),
    );
  }
  const ext = parts[1];
  if (!["jpg", "jpeg", "png"].includes(ext)) {
    return cb(new Error("Ekstensi file tidak diizinkan!"));
  }
  cb(null, true);
}

const uploadBukti = multer({
  storage: storageBukti,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: validateImageFile,
});

// HELPER: getPaketList dari DB
async function getPaketList() {
  const [rows] = await db.query(
    "SELECT nama_paket AS `key`, nama_paket AS label, durasi_menit AS durasi, deskripsi, harga, harga_asli FROM paket_ujian ORDER BY id ASC",
  );
  return rows;
}

const PAKET_LIST_FALLBACK = [
  {
    key: "Paket SKD/TKD",
    label: "Paket SKD/TKD",
    durasi: 90,
    deskripsi: null,
    harga: 50000,
    harga_asli: 100000,
  },
  {
    key: "Paket Akademik Polri",
    label: "Paket Akademik Polri",
    durasi: 90,
    deskripsi: null,
    harga: 50000,
    harga_asli: 100000,
  },
  {
    key: "Paket PPPK",
    label: "Paket PPPK",
    durasi: 120,
    deskripsi: null,
    harga: 50000,
    harga_asli: 100000,
  },
];

const PAKET_LIST = PAKET_LIST_FALLBACK;

function buildPaymentMap(payments, user = null, tryoutList = []) {
  const map = {};
  for (const p of payments) {
    const key = `${p.paket}_${p.nomor_to}`;
    if (!map[key]) {
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      const isExpired =
        createdAt && Date.now() - createdAt.getTime() > 7 * 24 * 60 * 60 * 1000;

      let status = p.status ? p.status.toUpperCase() : "KOSONG";
      if (isExpired && status === "LUNAS") status = "EXPIRED";

      let sisaWaktuText = "";
      if (createdAt && !isExpired && status === "LUNAS") {
        const diff = createdAt.getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        sisaWaktuText = days > 0 ? `${days} hari ${hours} jam` : `${hours} jam`;
      }

      map[key] = { ...p, status, sisaWaktuText };
    }
  }

  if (user && user.is_anggota && tryoutList.length > 0) {
    for (const toObj of tryoutList) {
      const key = `${toObj.paket}_${toObj.nomor_to}`;
      if (!map[key]) {
        map[key] = {
          id: null,
          user_id: user.id,
          paket: toObj.paket,
          nomor_to: toObj.nomor_to,
          status: "LUNAS",
          token_ujian: null,
          bukti_transfer: null,
          is_gratis: true,
        };
      }
    }
  } else if (user && user.is_anggota) {
    for (const paket of PAKET_LIST) {
      for (let to = 1; to <= 10; to++) {
        const key = `${paket.key}_${to}`;
        if (!map[key]) {
          map[key] = {
            id: null,
            user_id: user.id,
            paket: paket.key,
            nomor_to: to,
            status: "LUNAS",
            is_gratis: true,
          };
        }
      }
    }
  }

  return map;
}

// dashboard
router.get("/dashboard", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN")
      return res.redirect("/ujian/soal/1");

    const [payments] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );

    // Ambil skor ujian PERTAMA per user (lintas semua paket), ambil yang tertinggi
    const [rankingRows] = await db.query(`
  SELECT 
    u.id,
    u.username,
    r.skor,
    r.paket,
    r.nomor_to,
    r.tgl_selesai
  FROM users u
  JOIN riwayat_ujian r ON r.id = (
    SELECT id FROM riwayat_ujian r2
    WHERE r2.user_id = u.id
    ORDER BY r2.tgl_selesai ASC
    LIMIT 1
  )
  WHERE u.role != 'admin'
  ORDER BY r.skor DESC, r.tgl_selesai ASC
  LIMIT 10
`);

    const myRank = rankingRows.findIndex((r) => r.id === user.id) + 1;



    const [tryoutList] = await db.query(
      "SELECT * FROM paket_to WHERE is_published = 1 ORDER BY paket ASC, nomor_to ASC",
    );
    const [paketList] = await db.query(
      "SELECT nama_paket AS `key`, nama_paket AS label, durasi_menit AS durasi, deskripsi, harga, harga_asli FROM paket_ujian ORDER BY id ASC",
    );

    res.render("users/dashboard", {
      user,
      payments,
      paymentMap: buildPaymentMap(payments, user, tryoutList),
      rankings: rankingRows.slice(0, 5),
      myRank: myRank > 0 ? myRank : "-",
      tryoutList,
      paketList,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
});

// dashboardPembayaranUjian
router.get("/dashboardPembayaranUjian", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN")
      return res.redirect("/ujian/soal/1");

    const [paymentRows] = await db.query(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users
      WHERE skor > 0 AND skor IS NOT NULL
      ORDER BY skor DESC, id ASC LIMIT 5
    `);

    const myRank =
      rankingRows.findIndex((r) => r.username === user.username) + 1;

    const [riwayatUjian] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC",
      [userId],
    );

    let paketList;
    try {
      paketList = await getPaketList();
    } catch (e) {
      paketList = PAKET_LIST_FALLBACK;
    }

    const [tryoutList] = await db.query(
      "SELECT * FROM paket_to WHERE is_published = 1 ORDER BY paket ASC, nomor_to ASC",
    );
    const paymentMap = buildPaymentMap(paymentRows, user, tryoutList);

    res.render("users/dashboardPembayaranUjian", {
      user,
      paketList,
      tryoutList,
      paymentMap,
      rankings: rankingRows,
      myRank: myRank > 0 ? myRank : "-",
      riwayatUjian,
      uploadError: req.query.uploadError
        ? decodeURIComponent(req.query.uploadError)
        : null,
      successMsg: req.query.success
        ? decodeURIComponent(req.query.success)
        : null,
    });
  } catch (err) {
    console.error("Dashboard Pembayaran Error:", err);
    res.status(500).send("Terjadi kesalahan sistem.");
  }
});

// profil
router.get("/profil", isLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    const user = userRows[0];

    const [riwayatUjian] = await db.query(
      `SELECT r.*, p.created_at AS payment_created_at
       FROM riwayat_ujian r
       LEFT JOIN (
         SELECT user_id, paket, nomor_to, MAX(created_at) AS created_at
         FROM payments
         WHERE UPPER(status) = 'LUNAS'
         GROUP BY user_id, paket, nomor_to
       ) p ON r.user_id = p.user_id
           AND TRIM(r.paket) = TRIM(p.paket)
           AND r.nomor_to = p.nomor_to
       WHERE r.user_id = ?
       ORDER BY r.tgl_selesai DESC`,
      [userId],
    );

    res.render("users/profil", { user, riwayatUjian });
  } catch (err) {
    console.error("Profil Error:", err);
    res.status(500).send("Gagal memuat profil.");
  }
});

// POST /upload-bukti
router.post(
  "/upload-bukti",
  isLogin,
  uploadBukti.single("bukti"),
  async (req, res) => {
    const { paket_pilihan, nomor_to } = req.body;
    const userId = req.session.user.id;
    const buktiFilename = req.file ? req.file.filename : null;

    if (!buktiFilename) {
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("File bukti transfer wajib diunggah!"),
      );
    }

    if (!paket_pilihan || !nomor_to) {
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("Data paket atau nomor TO tidak valid."),
      );
    }

    const [paketCheck] = await db.query(
      "SELECT id FROM paket_ujian WHERE TRIM(nama_paket) = TRIM(?)",
      [paket_pilihan],
    );
    if (paketCheck.length === 0) {
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("Paket tidak dikenali."),
      );
    }

    try {
      const [existing] = await db.query(
        `SELECT id FROM payments
       WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ?
         AND UPPER(status) IN ('PENDING', 'LUNAS')`,
        [userId, paket_pilihan, nomor_to],
      );

      if (existing.length > 0) {
        if (req.file) {
          const fp = path.join(
            process.cwd(),
            "public",
            "uploads",
            "bukti",
            buktiFilename,
          );
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        return res.redirect(
          "/dashboardPembayaranUjian?uploadError=" +
            encodeURIComponent(
              `TO #${nomor_to} sudah memiliki pembayaran aktif atau sedang diproses.`,
            ),
        );
      }

      await db.query(
        `INSERT INTO payments (user_id, paket, nomor_to, bukti_transfer, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
        [userId, paket_pilihan, parseInt(nomor_to), buktiFilename],
      );

      res.redirect(
        "/dashboardPembayaranUjian?success=" +
          encodeURIComponent(
            "Bukti berhasil diupload! Admin akan memverifikasi dalam 1×24 jam.",
          ),
      );
    } catch (err) {
      console.error("Upload Bukti Error:", err);
      res.status(500).send("Gagal menyimpan data.");
    }
  },
);

// deleteAccount
router.post("/deleteAccount", isLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [userId],
    );

    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(
          process.cwd(),
          "public",
          "uploads",
          "bukti",
          p.bukti_transfer,
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM riwayat_ujian WHERE user_id = ?", [userId]);
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
