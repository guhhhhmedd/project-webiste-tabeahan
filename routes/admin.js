const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");

 
// MIDDLEWARE
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.render("login", { error: "Hanya admin yang bisa masuk!", rateLimited: false, resetTime: null });
}

async function isLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  try {
    const [rows] = await db.query(
      "SELECT expired_at, is_active FROM users WHERE id = ?",
      [req.session.user.id]
    );
    if (rows.length > 0) {
      req.session.user.expired_at = rows[0].expired_at;
      req.session.user.is_active  = rows[0].is_active;
    }
    next();
  } catch (err) {
    console.error("Middleware Error:", err);
    next();
  }
}

 
// MULTER — EXCEL
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

 
// DASHBOARD ADMIN
router.get("/dashboardAdmin", isAdmin, async (req, res) => {
  try {
    const [statsSoal] = await db.query(`
      SELECT TRIM(paket) AS paket, COUNT(*) AS total 
      FROM questions 
      GROUP BY TRIM(paket)
    `);

    const [[userStats]] = await db.query(`
      SELECT 
        COUNT(*) AS total_users,
        SUM(CASE WHEN status_ujian = 'SEDANG_UJIAN' THEN 1 ELSE 0 END) AS active_exam,
        SUM(CASE WHEN status_ujian = 'SELESAI' THEN 1 ELSE 0 END) AS finished_exam
      FROM users WHERE role != 'admin'
    `);

    const [chartDataRaw] = await db.query(`
      SELECT 
        DATE_FORMAT(create_at, '%M') AS bulan, 
        COUNT(*) AS jumlah 
      FROM users 
      GROUP BY YEAR(create_at), MONTH(create_at), DATE_FORMAT(create_at, '%M')
      ORDER BY YEAR(create_at) ASC, MONTH(create_at) ASC
    `);

    const chartData = {
      labels: chartDataRaw.map((d) => d.bulan),
      values: chartDataRaw.map((d) => d.jumlah),
    };

    const [daftarPaket] = await db.query("SELECT * FROM paket_ujian");

    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.status_ujian, u.skor, u.expired_at, u.is_active,
             p.id AS payment_id, p.paket AS payment_paket, p.nomor_to,
             p.bukti_transfer, p.status AS payment_status, p.token_ujian
      FROM users u
      LEFT JOIN payments p ON p.id = (
        SELECT id FROM payments 
        WHERE user_id = u.id AND UPPER(status) = 'PENDING'
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    const [[pendingRow]] = await db.query(`
      SELECT COUNT(DISTINCT p.user_id) AS cnt
      FROM payments p
      INNER JOIN users u ON u.id = p.user_id AND u.role != 'admin'
      WHERE UPPER(p.status) = 'PENDING'
    `);
    const pendingCount = pendingRow.cnt || 0;

    res.render("admin/dashboardAdmin", {
      statsSoal,
      daftarPaket,
      users,
      userStats,
      chartData,
      pendingCount,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("Gagal di dashboardAdmin:", err);
    res.status(500).send("Gagal memuat data admin.");
  }
});

 
// DAFTAR PESERTA
router.get("/admin/daftarPeserta", isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.create_at, u.password, u.status_ujian, u.skor
      FROM users u
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    const [allPayments] = await db.query(`
      SELECT p.id, p.user_id, p.paket, p.nomor_to, p.token_ujian,
             p.tgl_lunas, p.bukti_transfer, UPPER(p.status) AS status,
             p.created_at, p.expired_at
      FROM payments p
      JOIN users u ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY p.paket ASC, p.nomor_to ASC, p.created_at DESC
    `);

    const paymentsMap = {};
    for (const p of allPayments) {
      if (!paymentsMap[p.user_id]) paymentsMap[p.user_id] = [];
      paymentsMap[p.user_id].push(p);
    }

    res.render("admin/daftarPeserta", {
      users,
      paymentsMap,
      message: req.query.success || null,
      error:   req.query.error   || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data peserta.");
  }
});

 
// VERIFIKASI PEMBAYARAN
router.post("/admin/verify/:paymentId", isAdmin, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const [payments] = await db.query(
      "SELECT user_id, paket, nomor_to FROM payments WHERE id = ?",
      [paymentId]
    );
    if (!payments.length)
      return res.redirect("/admin/daftarPeserta?error=Data+tidak+ada");

    const userId = payments[0].user_id;
    const token  = crypto.randomBytes(4).toString("hex").toUpperCase();

    const [userRows] = await db.query(
      "SELECT expired_at FROM users WHERE id = ?",
      [userId]
    );
    let newExpiredDate = new Date();
    const currentExpired = userRows[0]?.expired_at;
    if (currentExpired && new Date(currentExpired) > new Date()) {
      newExpiredDate = new Date(currentExpired);
    }
    newExpiredDate.setDate(newExpiredDate.getDate() + 60);

    await Promise.all([
      db.query(
        "UPDATE payments SET status = 'LUNAS', token_ujian = ?, tgl_lunas = NOW() WHERE id = ?",
        [token, paymentId]
      ),
      db.query(
        "UPDATE users SET expired_at = ?, is_active = 1 WHERE id = ?",
        [newExpiredDate, userId]
      ),
    ]);

    res.redirect("/admin/daftarPeserta?success=Pembayaran+berhasil+diverifikasi");
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+verifikasi");
  }
});

 
// TOLAK PEMBAYARAN
router.post("/admin/reject/:paymentId", isAdmin, async (req, res) => {
  const { paymentId } = req.params;
  try {
    await db.query(
      "UPDATE payments SET status = 'DITOLAK' WHERE id = ?",
      [paymentId]
    );
    res.redirect("/admin/daftarPeserta?success=Pembayaran+ditolak.");
  } catch (err) {
    console.error("ERROR REJECT:", err);
    res.redirect("/admin/daftarPeserta?error=Gagal+menolak.");
  }
});

 
// KELOLA SOAL PER PAKET
router.get("/admin/kelola-soal/:paket", isAdmin, async (req, res) => {
  const namaPaket = decodeURIComponent(req.params.paket);
  const filterTo  = parseInt(req.query.to) || 1;

  try {
    const [soalList] = await db.query(
      `SELECT q.*, m.nama_materi 
       FROM questions q 
       LEFT JOIN materi_list m ON q.materi_id = m.id 
       WHERE TRIM(q.paket) = ? AND q.nomor_to = ? 
       ORDER BY q.nomor_urut ASC`,
      [namaPaket, filterTo]
    );

    const totalAktif = soalList.filter((s) => s.is_active == 1).length;

    const [configRows] = await db.query(
      "SELECT jumlah_soal, durasi_menit FROM paket_ujian WHERE nama_paket = ?",
      [namaPaket]
    );
    const config = configRows[0] || { jumlah_soal: 0, durasi_menit: 0 };

    const [availTo] = await db.query(
      "SELECT DISTINCT nomor_to FROM questions WHERE TRIM(paket) = ? ORDER BY nomor_to ASC",
      [namaPaket]
    );

    res.render("admin/kelolaSoal", {
      paket: namaPaket,
      soalList,
      totalAktif,
      config,
      currentTo: filterTo,
      availTo: availTo.map((r) => r.nomor_to),
      message: req.query.msg || null,
      error:   req.query.err || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil data soal.");
  }
});

 
// TAMBAH SOAL MANUAL
router.post("/admin/tambah-soal", isAdmin, async (req, res) => {
  const { paket, nomor_to, materi_id, nomor_urut, soal, a, b, c, d, e, kunci, pembahasan } = req.body;
  try {
    await db.query(
      `INSERT INTO questions (paket, nomor_to, materi_id, nomor_urut, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paket, nomor_to, materi_id, nomor_urut, soal, a, b, c, d, e, kunci, pembahasan || '']
    );
    res.redirect("/dashboardAdmin?message=Soal+berhasil+ditambah");
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.redirect(
        `/dashboardAdmin?error=Gagal!+Nomor+urut+${nomor_urut}+sudah+ada+di+paket+dan+TO+ini.`
      );
    }
    res.redirect("/dashboardAdmin?error=Gagal+tambah+soal.");
  }
});

 
// UPDATE SOAL
router.post("/admin/updateSoal", isAdmin, async (req, res) => {
  const { id, paket, nomor_to, materi_id, nomor_urut, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan } = req.body;
  try {
    await db.query(
      `UPDATE questions 
       SET paket=?, nomor_to=?, materi_id=?, nomor_urut=?, soal=?,
           opsi_a=?, opsi_b=?, opsi_c=?, opsi_d=?, opsi_e=?, kunci=?, pembahasan=?
       WHERE id=?`,
      [paket, nomor_to, materi_id, nomor_urut, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan || '', id]
    );
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nomor_to}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal update soal.");
  }
});

 
// IMPORT SOAL — EXCEL
router.post("/admin/upload-soal", isAdmin, uploadExcel.single("fileExcel"), async (req, res) => {
  if (!req.file) return res.status(400).send("File tidak ditemukan.");

  try {
    const workbook  = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows      = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let inserted = 0, skipped = 0;
    const duplicateErrors = [];

    for (const row of rows) {
      const paket    = (row.paket || "").trim();
      const nomorTo  = parseInt(row.nomor_to);
      const nomorUrut = row.nomor_urut;

      if (!nomorTo || isNaN(nomorTo)) { skipped++; continue; }

      try {
        await db.query(
          `INSERT INTO questions 
           (paket, nomor_to, materi_id, nomor_urut, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [paket, nomorTo, row.materi_id, nomorUrut, row.soal,
           row.a, row.b, row.c, row.d, row.e,
           (row.kunci || "").toString().trim().toUpperCase(),
           (row.pembahasan || "").toString().trim()]
        );
        inserted++;
      } catch (dbErr) {
        if (dbErr.code === "ER_DUP_ENTRY") {
          duplicateErrors.push(`No.${nomorUrut} (${paket} TO ${nomorTo})`);
          skipped++;
        } else {
          throw dbErr;
        }
      }
    }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    let msg = `Import selesai: ${inserted} soal ditambah.`;
    if (duplicateErrors.length > 0)
      msg += ` ${duplicateErrors.length} nomor duplikat dilewati.`;

    res.redirect(`/dashboardAdmin?message=${encodeURIComponent(msg)}`);
  } catch (err) {
    console.error("ERROR IMPORT EXCEL:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.redirect("/dashboardAdmin?error=Gagal+proses+Excel.+Cek+format+kolom+dan+materi_id.");
  }
});

 
// TOGGLE AKTIF SOAL (JSON)
router.post("/admin/toggle-soal", isAdmin, async (req, res) => {
  const { id, is_active } = req.body;
  try {
    await db.query("UPDATE questions SET is_active = ? WHERE id = ?", [is_active, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

 
// TOGGLE SEMUA SOAL DALAM SATU TO
router.post("/admin/toggle-all-soal", isAdmin, async (req, res) => {
  const { paket, is_active, current_to } = req.body;
  try {
    await db.query(
      "UPDATE questions SET is_active = ? WHERE paket = ? AND nomor_to = ?",
      [is_active, paket, current_to]
    );
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${current_to}&message=Status+TO+Nomor+${current_to}+berhasil+diubah`
    );
  } catch (err) {
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${current_to}&error=Gagal+update`
    );
  }
});

 
// UPDATE CONFIG PAKET (jumlah soal + durasi)
router.post("/admin/update-config-paket", isAdmin, async (req, res) => {
  const { paket, jumlah_soal, durasi_menit } = req.body;
  try {
    await db.query(
      "UPDATE paket_ujian SET jumlah_soal = ?, durasi_menit = ? WHERE nama_paket = ?",
      [parseInt(jumlah_soal), parseInt(durasi_menit), paket]
    );
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}?message=Konfigurasi+berhasil+diupdate`);
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}?error=Gagal+update`);
  }
});

 
// EDIT SOAL — GET FORM
router.get("/admin/editSoal/:id", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.redirect("/dashboardAdmin");
    res.render("admin/editSoal", { s: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

 
// HAPUS SOAL
router.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}?message=Soal+berhasil+dihapus`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menghapus soal.");
  }
});

 
// UPDATE DURASI PAKET
router.post("/admin/update-durasi", isAdmin, async (req, res) => {
  const { id, durasi } = req.body;
  try {
    await db.query("UPDATE paket_ujian SET durasi_menit = ? WHERE id = ?", [durasi, id]);
    res.redirect("/dashboardAdmin?message=Durasi+berhasil+diperbarui");
  } catch (err) {
    res.redirect("/dashboardAdmin?error=Gagal+update+durasi");
  }
});

 
// HAPUS AKUN DARI ADMIN
router.post("/deleteAccountFromAdmin", isAdmin, async (req, res) => {
  const { id } = req.body;
  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [id]
    );
    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(process.cwd(), "public", "uploads", "bukti", p.bukti_transfer);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    await Promise.all([
      db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [id]),
      db.query("DELETE FROM riwayat_ujian WHERE user_id = ?",   [id]),
      db.query("DELETE FROM payments WHERE user_id = ?",        [id]),
      db.query("DELETE FROM users WHERE id = ?",                [id]),
    ]);

    res.redirect("/dashboardAdmin?message=Akun+dan+seluruh+data+terkait+berhasil+dihapus");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal hapus data.");
  }
});

 
// RESET UJIAN USER dari admin
router.post("/admin/reset-ujian-user", isAdmin, async (req, res) => {
  const { userIdTarget, paket_pilihan, nomor_to } = req.body;
  try {
    await Promise.all([
      db.query(
        "UPDATE payments SET status = 'LUNAS' WHERE user_id = ? AND paket = ? AND nomor_to = ?",
        [userIdTarget, paket_pilihan, nomor_to]
      ),
      db.query(
        `DELETE FROM jawaban_peserta
         WHERE user_id = ?
           AND question_id IN (SELECT id FROM questions WHERE paket = ? AND nomor_to = ?)`,
        [userIdTarget, paket_pilihan, nomor_to]
      ),
      db.query(
        "UPDATE users SET status_ujian = 'IDLE' WHERE id = ?",
        [userIdTarget]
      ),
    ]);
    res.redirect("/admin/daftarPeserta?success=Ujian+berhasil+direset%2C+user+bisa+ujian+kembali");
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+reset+ujian");
  }
});

 
// HAPUS SATU RIWAYAT PAYMENT (per TO)
router.post("/admin/delete-payment", isAdmin, async (req, res) => {
  const { paymentId } = req.body;
  try {
    const [rows] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE id = ?",
      [paymentId]
    );
    if (rows.length > 0 && rows[0].bukti_transfer) {
      const filePath = path.join(process.cwd(), "public", "uploads", "bukti", rows[0].bukti_transfer);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.query("DELETE FROM payments WHERE id = ?", [paymentId]);
    res.redirect("/admin/daftarPeserta?success=Riwayat+pembayaran+berhasil+dihapus");
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+hapus+riwayat");
  }
});

 
// GET /admin/anggota — halaman kelola anggota offline
router.get("/admin/anggota", isAdmin, async (req, res) => {
  try {
    const [anggota] = await db.query(
      "SELECT * FROM anggota_offline ORDER BY created_at DESC"
    );
    const [userCount] = await db.query(
      "SELECT COUNT(*) AS total FROM users WHERE is_anggota = 1"
    );
    res.render("admin/anggota", {
      anggota,
      totalAktif: userCount[0].total,
      message: req.query.success ? decodeURIComponent(req.query.success) : null,
      error:   req.query.error   ? decodeURIComponent(req.query.error)   : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data anggota.");
  }
});

 
// POST /admin/anggota/tambah — tambah email anggota
router.post("/admin/anggota/tambah", isAdmin, async (req, res) => {
  const { email, nama, catatan } = req.body;

  if (!email || !email.includes("@")) {
    return res.redirect("/admin/anggota?error=" + encodeURIComponent("Email tidak valid."));
  }

  try {
    await db.query(
      "INSERT INTO anggota_offline (email, nama, catatan) VALUES (?, ?, ?)",
      [email.toLowerCase().trim(), nama || null, catatan || null]
    );

    await db.query(
      "UPDATE users SET is_anggota = 1 WHERE LOWER(email) = LOWER(?)",
      [email.trim()]
    );

    res.redirect("/admin/anggota?success=" + encodeURIComponent(`Email ${email} berhasil ditambahkan.`));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.redirect("/admin/anggota?error=" + encodeURIComponent("Email sudah terdaftar di whitelist."));
    }
    console.error(err);
    res.redirect("/admin/anggota?error=" + encodeURIComponent("Gagal menambahkan email."));
  }
});

 
// POST /admin/anggota/hapus — hapus email dari whitelist
router.post("/admin/anggota/hapus", isAdmin, async (req, res) => {
  const { id, email } = req.body;

  try {
    await db.query("DELETE FROM anggota_offline WHERE id = ?", [id]);

    await db.query(
      "UPDATE users SET is_anggota = 0 WHERE LOWER(email) = LOWER(?)",
      [email]
    );

    res.redirect("/admin/anggota?success=" + encodeURIComponent("Email berhasil dihapus dari whitelist."));
  } catch (err) {
    console.error(err);
    res.redirect("/admin/anggota?error=" + encodeURIComponent("Gagal menghapus email."));
  }
});

module.exports = router;