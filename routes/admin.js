const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");

// ─── Middleware ───────────────────────────────────────────
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.render("login", {
    error: "Hanya admin yang bisa masuk!",
    rateLimited: false,
    resetTime: null,
  });
}

// ─── Multer Excel ─────────────────────────────────────────
const storageExcel = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/excel_temp/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadExcel = multer({ storage: storageExcel });

// ========================
// DASHBOARD ADMIN
// ========================
router.get("/dashboardAdmin", isAdmin, async (req, res) => {
  try {
    const [statsSoal] = await db.query(`
      SELECT TRIM(paket) AS paket, COUNT(*) AS total 
      FROM questions 
      GROUP BY TRIM(paket)
    `);

    const [[userStats]] = await db.query(`
  SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN status_ujian = 'sedang_ujian' THEN 1 ELSE 0 END) as active_exam,
    SUM(CASE WHEN status_ujian = 'selesai' THEN 1 ELSE 0 END) as finished_exam
  FROM users WHERE role != 'admin'
`);

    const [chartDataRaw] = await db.query(`
  SELECT 
    DATE_FORMAT(create_at, '%M') AS bulan, 
    COUNT(*) AS jumlah 
FROM users 
GROUP BY YEAR(create_at), MONTH(create_at), DATE_FORMAT(create_at, '%M')
ORDER BY YEAR(create_at) ASC, MONTH(create_at) ASC;
`);

    const chartData = {
      labels: chartDataRaw.map((d) => d.bulan),
      values: chartDataRaw.map((d) => d.jumlah),
    };

    const [daftarPaket] = await db.query("SELECT * FROM paket_ujian");

    // Ambil semua user non-admin beserta payment PENDING terbaru (jika ada)
    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.status_ujian, u.skor,
             p.id AS payment_id, p.paket AS payment_paket,
             p.bukti_transfer, p.status AS payment_status, p.token_ujian
      FROM users u
      LEFT JOIN payments p ON p.id = (
        SELECT id FROM payments 
        WHERE user_id = u.id AND status = 'PENDING'
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    res.render("admin/dashboardAdmin", {
      statsSoal,
      daftarPaket,
      users,
      userStats,
      chartData,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("Gagal di dashboardAdmin:", err);
    res.status(500).send("Gagal memuat data admin.");
  }
});

// ========================
// DAFTAR PESERTA
// ========================
router.get("/admin/daftarPeserta", isAdmin, async (req, res) => {
  try {
    // Ambil semua user dengan semua payments mereka
    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.password, u.status_ujian, u.skor
      FROM users u
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    // Untuk setiap user, ambil semua payments
    const [allPayments] = await db.query(`
      SELECT p.*, u.username
      FROM payments p
      JOIN users u ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY p.created_at DESC
    `);

    // Buat map user_id -> payments[]
    const paymentsMap = {};
    for (const p of allPayments) {
      if (!paymentsMap[p.user_id]) paymentsMap[p.user_id] = [];
      paymentsMap[p.user_id].push(p);
    }

    res.render("admin/daftarPeserta", {
      users,
      paymentsMap,
      message: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data peserta.");
  }
});

// ========================
// VERIFIKASI PEMBAYARAN — by paymentId
// ========================
router.post("/admin/verify/:paymentId", isAdmin, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const [payments] = await db.query("SELECT * FROM payments WHERE id = ?", [
      paymentId,
    ]);
    if (!payments.length)
      return res.redirect(
        "/admin/daftarPeserta?error=Payment+tidak+ditemukan.",
      );

    // Generate token unik untuk paket ini
    const token = crypto.randomBytes(4).toString("hex").toUpperCase();

    await db.query(
      "UPDATE payments SET status = 'LUNAS', token_ujian = ?, tgl_lunas = NOW() WHERE id = ?",
      [token, paymentId],
    );

    res.redirect(
      `/admin/daftarPeserta?success=Pembayaran+diverifikasi,+token+${token}+digenerate.`,
    );
  } catch (err) {
    console.error("ERROR VERIFIKASI:", err);
    res.redirect("/admin/daftarPeserta?error=Gagal+verifikasi.");
  }
});

// ========================
// TOLAK PEMBAYARAN — by paymentId
// ========================
router.post("/admin/reject/:paymentId", isAdmin, async (req, res) => {
  const { paymentId } = req.params;
  try {
    await db.query("UPDATE payments SET status = 'DITOLAK' WHERE id = ?", [
      paymentId,
    ]);
    res.redirect("/admin/daftarPeserta?success=Pembayaran+ditolak.");
  } catch (err) {
    console.error("ERROR REJECT:", err);
    res.redirect("/admin/daftarPeserta?error=Gagal+menolak.");
  }
});

// ========================
// SOAL — TAMBAH MANUAL
// ========================
router.post("/admin/tambah-soal", isAdmin, async (req, res) => {
  const { paket, materi, soal, a, b, c, d, e, kunci } = req.body;
  try {
    await db.query(
      `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paket, materi, soal, a, b, c, d, e, kunci],
    );
    res.redirect("/dashboardAdmin?message=Soal+berhasil+ditambah");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal tambah soal.");
  }
});

// ========================
// SOAL — IMPORT EXCEL
// ========================
router.post(
  "/admin/upload-soal",
  isAdmin,
  uploadExcel.single("fileExcel"),
  async (req, res) => {
    if (!req.file) return res.status(400).send("File tidak ditemukan.");

    const validPaket = ["Paket SKD/TKD", "Paket Akademik Polri", "Paket PPPK"];

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        const paket = (row.paket || "").trim();
        if (!validPaket.includes(paket)) {
          skipped++;
          continue;
        }

        await db.query(
          `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paket,
            row.materi,
            row.soal,
            row.a,
            row.b,
            row.c,
            row.d,
            row.e,
            row.kunci,
          ],
        );
        inserted++;
      }

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.redirect(
        `/dashboardAdmin?message=Import+berhasil:+${inserted}+soal+ditambah,+${skipped}+dilewati.`,
      );
    } catch (err) {
      console.error("ERROR IMPORT EXCEL:", err);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      res.status(500).send("Gagal proses Excel.");
    }
  },
);

// ========================
// SOAL — KELOLA PER PAKET
// ========================
router.get("/admin/kelola-soal/:paket", isAdmin, async (req, res) => {
  const namaPaket = decodeURIComponent(req.params.paket);
  try {
    const [soalList] = await db.query(
      "SELECT * FROM questions WHERE TRIM(paket) = ? ORDER BY is_active DESC, id DESC",
      [namaPaket],
    );
    const [configRows] = await db.query(
      "SELECT * FROM paket_ujian WHERE nama_paket = ? LIMIT 1",
      [namaPaket],
    );
    const config = configRows[0] || { jumlah_soal: 100, durasi_menit: 90 };
    const totalAktif = soalList.filter((s) => s.is_active).length;
    res.render("admin/kelolaSoal", {
      paket: namaPaket,
      soalList,
      config,
      totalAktif,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil data soal.");
  }
});

// ========================
// SOAL — TOGGLE AKTIF (JSON)
// ========================
router.post("/admin/toggle-soal", isAdmin, async (req, res) => {
  const { id, is_active } = req.body;
  try {
    await db.query("UPDATE questions SET is_active = ? WHERE id = ?", [
      is_active,
      id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

// ========================
// SOAL — AKTIFKAN / NONAKTIFKAN SEMUA
// ========================
router.post("/admin/toggle-all-soal", isAdmin, async (req, res) => {
  const { paket, is_active } = req.body;
  try {
    await db.query("UPDATE questions SET is_active = ? WHERE paket = ?", [
      is_active,
      paket,
    ]);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Semua+soal+berhasil+diperbarui.`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?error=Gagal+update.`,
    );
  }
});

// ========================
// PAKET — UPDATE JUMLAH SOAL
// ========================
router.post("/admin/update-config-paket", isAdmin, async (req, res) => {
  const { paket, jumlah_soal, durasi_menit } = req.body; // Nangkep 3 data sekaligus
  try {
    await db.query(
      "UPDATE paket_ujian SET jumlah_soal = ?, durasi_menit = ? WHERE nama_paket = ?",
      [parseInt(jumlah_soal), parseInt(durasi_menit), paket],
    );
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Konfigurasi+berhasil+diupdate`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?error=Gagal+update`,
    );
  }
});

// ========================
// SOAL — EDIT & UPDATE
// ========================
router.get("/admin/editSoal/:id", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.redirect("/dashboardAdmin");
    res.render("admin/editSoal", { s: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

router.post("/admin/updateSoal", isAdmin, async (req, res) => {
  const {
    id,
    paket,
    materi,
    soal,
    opsi_a,
    opsi_b,
    opsi_c,
    opsi_d,
    opsi_e,
    kunci,
  } = req.body;
  try {
    await db.query(
      `UPDATE questions 
       SET paket=?, materi=?, soal=?, opsi_a=?, opsi_b=?, opsi_c=?, opsi_d=?, opsi_e=?, kunci=? 
       WHERE id=?`,
      [paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, id],
    );
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal update soal.");
  }
});

// ========================
// SOAL — HAPUS
// ========================
router.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Soal+berhasil+dihapus`,
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menghapus soal.");
  }
});

// ========================
// DURASI UJIAN
// ========================
router.post("/admin/update-durasi", isAdmin, async (req, res) => {
  const { id, durasi } = req.body;
  try {
    await db.query("UPDATE paket_ujian SET durasi_menit = ? WHERE id = ?", [
      durasi,
      id,
    ]);
    res.redirect("/dashboardAdmin?message=Durasi+berhasil+diperbarui");
  } catch (err) {
    res.redirect("/dashboardAdmin?error=Gagal+update+durasi");
  }
});

// ========================
// HAPUS AKUN DARI ADMIN
// ========================
router.post("/deleteAccountFromAdmin", isAdmin, async (req, res) => {
  const { id } = req.body;
  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [id],
    );
    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(
          __dirname,
          "../public/uploads/bukti/",
          p.bukti_transfer,
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [id]);
    await db.query("DELETE FROM users WHERE id = ?", [id]);

    res.redirect("/dashboardAdmin?message=Akun+berhasil+dihapus");
  } catch (err) {
    console.error("Gagal hapus akun:", err);
    res.status(500).send("Database error!");
  }
});

module.exports = router;
