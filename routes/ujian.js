const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// MIDDLEWARE
function isSedangUjian(req, res, next) {
  if (req.session.ujian) return next();
  res.redirect("/dashboardPembayaranUjian");
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.status(403).send("Akses Ditolak: Hanya Admin yang bisa mereset ujian!");
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

// POST /ujian/mulai
router.post("/mulai", isLogin, async (req, res) => {
  const { paket_pilihan, nomor_to } = req.body;
  const userId = req.session.user.id;

  try {
    const [payment] = await db.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ? AND UPPER(status) = 'LUNAS'`,
      [userId, paket_pilihan, nomor_to]
    );

    const isAnggota = req.session.user.is_anggota == 1;

    if (payment.length === 0 && !isAnggota) {
      return res.send(`<script>
        alert('Akses tidak ditemukan! Pembayaran TO ini belum diverifikasi atau sudah digunakan.');
        window.location.href='/dashboardPembayaranUjian';
      </script>`);
    }

    const paymentId = payment.length > 0 ? payment[0].id : null;

    const [soalCheck] = await db.query(
      "SELECT COUNT(*) AS total FROM questions WHERE TRIM(paket) = TRIM(?) AND nomor_to = ? AND is_active = 1",
      [paket_pilihan, nomor_to]
    );

    if (soalCheck[0].total === 0) {
      return res.send(`<script>
        alert('Soal untuk TO #${nomor_to} belum tersedia. Hubungi admin.');
        window.location.href='/dashboardPembayaranUjian';
      </script>`);
    }

    const [config] = await db.query(
      "SELECT durasi_menit FROM paket_ujian WHERE TRIM(nama_paket) = TRIM(?)",
      [paket_pilihan]
    );
    const durasiMs = (config[0]?.durasi_menit || 100) * 60 * 1000;

      req.session.ujian = {
      paymentId: paymentId,
      paket:     paket_pilihan,
      nomorTO:   parseInt(nomor_to),
      jawaban:   {},
      startTime: Date.now(),
      durasiMs:  durasiMs,
    };

    await db.query(
      "UPDATE users SET status_ujian = 'SEDANG_UJIAN' WHERE id = ?",
      [userId]
    );

    res.redirect("/ujian/soal/1");
  } catch (err) {
    console.error("Error /mulai:", err);
    res.status(500).send("Gagal memulai ujian.");
  }
});

// GET /ujian/soal/:index
router.get("/soal/:index", isLogin, isSedangUjian, async (req, res) => {
  const sesi = req.session.ujian;

  // Cek waktu habis
  if (Date.now() - sesi.startTime >= sesi.durasiMs) {
    return res.redirect("/ujian/selesai-paksa");
  }

  try {
    const [soalRows] = await db.query(
      `SELECT * FROM questions
       WHERE TRIM(paket) = TRIM(?) AND nomor_to = ? AND is_active = 1
       ORDER BY nomor_urut ASC`,
      [sesi.paket, sesi.nomorTO]
    );

    if (!soalRows || soalRows.length === 0) {
      return res.send(`<script>
        alert('Soal tidak ditemukan! Hubungi admin.');
        window.location.href='/dashboardPembayaranUjian';
      </script>`);
    }

    res.render("ujian-soal", {
      soal:       soalRows,       
      jawaban:    sesi.jawaban,   
      waktuMulai: sesi.startTime,
      durasiMs:   sesi.durasiMs,
      paket:      sesi.paket,
      nomorTO:    sesi.nomorTO,
      user:       req.session.user,
    });
  } catch (err) {
    console.error("Error /soal:", err);
    res.status(500).send("Gagal memuat soal.");
  }
});

// POST /ujian/simpan-jawaban
router.post("/simpan-jawaban", isLogin, isSedangUjian, async (req, res) => {
  const sesi = req.session.ujian;
  const { questionId, jawaban } = req.body;

  if (Date.now() - sesi.startTime >= sesi.durasiMs) {
    return res.json({ ok: false, expired: true });
  }

  if (questionId && jawaban) {
    sesi.jawaban[questionId] = jawaban;
    req.session.ujian = sesi;
    req.session.save(() => res.json({ ok: true }));
  } else {
    res.json({ ok: true });
  }
});

// POST /ujian/selesai
router.post("/selesai", isLogin, async (req, res) => {
  if (!req.session.ujian)
    return res.json({ ok: false, redirect: "/dashboardPembayaranUjian" });
  await hitungDanSimpanSkor(req, res, true);
});

// GET /ujian/selesai-paksa
router.get("/selesai-paksa", isLogin, async (req, res) => {
  if (!req.session.ujian)
    return res.redirect("/dashboardPembayaranUjian");
  await hitungDanSimpanSkor(req, res, false);
});

// HITUNG & SIMPAN SKOR
async function hitungDanSimpanSkor(req, res, jsonResponse = false) {
  const sesi   = req.session.ujian;
  const userId = req.session.user.id;

  try {
    const [soalRows] = await db.query(
      `SELECT id, kunci FROM questions
       WHERE TRIM(paket) = TRIM(?) AND nomor_to = ? AND is_active = 1`,
      [sesi.paket, sesi.nomorTO]
    );

    let benar = 0;
    const jawabanUserSesi = sesi.jawaban;

    // Simpan semua jawaban + hitung skor
    const simpanPromises = soalRows.map((s) => {
      const jawabanUser = jawabanUserSesi[s.id] || null;
      if (jawabanUser && jawabanUser === s.kunci) benar++;

      return db.query(
        `INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE jawaban_user = ?`,
        [userId, s.id, jawabanUser, jawabanUser]
      );
    });

    await Promise.all(simpanPromises);

    const totalSoal = soalRows.length;
    const skor      = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;

    await Promise.all([
      db.query(
        `INSERT INTO riwayat_ujian (user_id, paket, nomor_to, skor, jml_benar, jml_soal, tgl_selesai)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, sesi.paket, sesi.nomorTO, skor, benar, totalSoal]
      ),
      sesi.paymentId
        ? db.query(
            `UPDATE payments SET status = 'SELESAI'
             WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ? AND UPPER(status) = 'LUNAS'`,
            [userId, sesi.paket, sesi.nomorTO]
          )
        : Promise.resolve(),
      db.query(
        "UPDATE users SET status_ujian = 'IDLE' WHERE id = ?",
        [userId]
      ),
    ]);

    delete req.session.ujian;

    req.session.save(() => {
      if (jsonResponse) return res.json({ ok: true, redirect: "/ujian/hasil" });
      res.redirect("/ujian/hasil");
    });
  } catch (err) {
    console.error("Error hitungDanSimpanSkor:", err);
    if (jsonResponse) return res.json({ ok: false, redirect: "/dashboardPembayaranUjian" });
    res.redirect("/dashboardPembayaranUjian");
  }
}

// POST /ujian/reset-ujian (admin only)
router.post("/reset-ujian", isLogin, isAdmin, async (req, res) => {
  const { userIdTarget, paket_pilihan, nomor_to } = req.body;

  try {
    await Promise.all([
      db.query(
        "UPDATE payments SET status = 'LUNAS' WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ?",
        [userIdTarget, paket_pilihan, nomor_to]
      ),
      db.query(
        `DELETE FROM jawaban_peserta
         WHERE user_id = ?
           AND question_id IN (
             SELECT id FROM questions WHERE TRIM(paket) = TRIM(?) AND nomor_to = ?
           )`,
        [userIdTarget, paket_pilihan, nomor_to]
      ),
      db.query(
        "UPDATE users SET status_ujian = 'IDLE' WHERE id = ?",
        [userIdTarget]
      ),
    ]);

    res.redirect("/admin/daftarPeserta?success=Ujian+berhasil+direset%2C+user+bisa+ujian+kembali");
  } catch (err) {
    console.error("Error reset-ujian:", err);
    res.redirect("/admin/daftarPeserta?error=Gagal+reset+ujian");
  }
});

// GET /ujian/hasil
router.get("/hasil", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC LIMIT 1",
      [userId]
    );

    if (rows.length === 0) return res.redirect("/dashboardPembayaranUjian");

    res.render("hasilUjian", {
      skor:      rows[0].skor,
      benar:     rows[0].jml_benar,
      totalSoal: rows[0].jml_soal,
      paket:     rows[0].paket,
      nomorTO:   rows[0].nomor_to,
      user:      req.session.user,
    });
  } catch (err) {
    console.error("Error /hasil:", err);
    res.redirect("/dashboardPembayaranUjian");
  }
});

// GET /ujian/review?nomor_to=X
router.get("/review", isLogin, async (req, res) => {
  const { nomor_to, paket } = req.query;
  const userId = req.session.user.id;

  if (!nomor_to) {
    return res.redirect(
      "/dashboardPembayaranUjian?uploadError=" +
        encodeURIComponent("Pilih TO yang ingin di-review.")
    );
  }

  try {
    const [jawabanRows] = await db.query(
      `SELECT
         jp.question_id,
         jp.jawaban_user,
         q.soal, q.paket, q.nomor_to,
         q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e,
         q.kunci,
         CASE WHEN jp.jawaban_user = q.kunci THEN 1 ELSE 0 END AS is_benar
       FROM jawaban_peserta jp
       JOIN questions q ON jp.question_id = q.id
       WHERE jp.user_id = ? AND q.nomor_to = ?
       ORDER BY q.nomor_urut ASC`,
      [userId, nomor_to]
    );

    if (jawabanRows.length === 0) {
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("Tidak ada data review untuk TO #" + nomor_to)
      );
    }

    const totalSoal  = jawabanRows.length;
    const totalBenar = jawabanRows.filter((j) => j.is_benar).length;
    const totalSalah = totalSoal - totalBenar;
    const skor       = Math.round((totalBenar / totalSoal) * 100);

    const [riwayat] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? AND nomor_to = ? ORDER BY tgl_selesai DESC LIMIT 1",
      [userId, nomor_to]
    );

    const [userRows] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    res.render("reviewJawaban", {
      user:       userRows[0],
      soalRows:   jawabanRows,
      totalSoal,
      totalBenar,
      totalSalah,
      skor,
      nomor_to,
      paket:      riwayat[0]?.paket || paket || "",
      tglSelesai: riwayat[0]?.tgl_selesai || null,
    });
  } catch (err) {
    console.error("ERROR /review:", err);
    res.redirect("/dashboardPembayaranUjian?error=Gagal+memuat+review");
  }
});

module.exports = router;
