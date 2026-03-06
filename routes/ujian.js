const express = require("express");
const router = express.Router();
const db = require("../config/db");

// MIDDLEWARE
function isSedangUjian(req, res, next) {
  if (req.session.ujian) return next();
  res.redirect("/users/dashboardPembayaranUjian");
}

async function isLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  try {
    const [rows] = await db.query(
      "SELECT expired_at, is_active FROM users WHERE id = ?",
      [req.session.user.id],
    );
    if (rows.length > 0) {
      req.session.user.expired_at = rows[0].expired_at;
      req.session.user.is_active = rows[0].is_active;
    }
    next();
  } catch (err) {
    console.error("Middleware Error:", err);
    next();
  }
}

// POST /mulai
router.post("/mulai", isLogin, async (req, res) => {
  const { paket_pilihan, nomor_to } = req.body;
  const userId = req.session.user.id;

  try {
    const [payment] = await db.query(
      `SELECT id FROM payments 
             WHERE user_id = ? AND paket = ? AND nomor_to = ? AND status = 'LUNAS'`,
      [userId, paket_pilihan, nomor_to],
    );

    if (payment.length === 0) {
      return res.send(
        "<script>alert('Akses tidak ditemukan atau sudah selesai!'); window.location.href='/dashboard';</script>",
      );
    }

    // AMBIL DURASI DARI KONFIGURASI PAKET
    const [config] = await db.query(
      "SELECT durasi_menit FROM paket_ujian WHERE nama_paket = ?",
      [paket_pilihan],
    );
    const durasiMs = (config[0]?.durasi_menit || 100) * 60 * 1000;

    const [soal] = await db.query(
      "SELECT id FROM questions WHERE paket = ? AND nomor_to = ? AND is_active = 1 ORDER BY nomor_urut ASC",
      [paket_pilihan, nomor_to],
    );

    req.session.ujian = {
      paymentId: payment[0].id,
      paket: paket_pilihan,
      nomorTO: nomor_to,
      soalIds: soal.map((s) => s.id),
      jawaban: {},
      startTime: Date.now(),
      durasiMs: durasiMs, // SEKARANG DURASI MASUK KE SESSION
    };

    res.redirect("/ujian/soal/1");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memulai.");
  }
});

// GET /soal
router.get("/soal/:index", isLogin, isSedangUjian, async (req, res) => {
  const sesi = req.session.ujian;
  const index = parseInt(req.params.index) - 1; // index array mulai dari 0

  if (index < 0 || index >= sesi.soalIds.length) {
    return res.redirect("/ujian/soal/1");
  }

  const currentSoalId = sesi.soalIds[index];

  // Cek sisa waktu
  const elapsed = Date.now() - sesi.startTime;
  if (elapsed >= sesi.durasiMs) return res.redirect("/ujian/selesai-paksa");

  try {
    const [soalRow] = await db.query("SELECT * FROM questions WHERE id = ?", [
      currentSoalId,
    ]);

    res.render("ujian-soal", {
      soal: soalRow[0],
      currentIndex: index + 1,
      totalSoal: sesi.soalIds.length,
      jawaban: sesi.jawaban,
      waktuMulai: sesi.startTime,
      durasiMs: sesi.durasiMs,
      paket: sesi.paket,
      nomorTO: sesi.nomorTO,
    });
  } catch (err) {
    res.status(500).send("Error");
  }
});

// simpan-jawaban
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

// selesai
router.post("/selesai", isLogin, async (req, res) => {
  if (!req.session.ujian)
    return res.json({ ok: false, redirect: "/users/dashboardPembayaranUjian" });
  await hitungDanSimpanSkor(req, res, true);
});

router.get("/selesai-paksa", isLogin, async (req, res) => {
  if (!req.session.ujian)
    return res.redirect("/users/dashboardPembayaranUjian");
  await hitungDanSimpanSkor(req, res, false);
});

//  HITUNG SKOR
async function hitungDanSimpanSkor(req, res, jsonResponse = false) {
  const sesi = req.session.ujian;
  const userId = req.session.user.id;

  try {
    const jawabanUserSesi = sesi.jawaban;
    let benar = 0;
    const soalIds = sesi.soalIds;

    const [soalRows] = await db.query(
      "SELECT id, kunci FROM questions WHERE id IN (?)",
      [soalIds],
    );

    const simpanJawabanPromises = soalRows.map((s) => {
      const jawabanUser = jawabanUserSesi[s.id] || null;
      if (jawabanUser === s.kunci) benar++;

      return db.query(
        "INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE jawaban_user = ?",
        [userId, s.id, jawabanUser, jawabanUser],
      );
    });

    await Promise.all(simpanJawabanPromises);
    const totalSoal = soalIds.length;
    const skor = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;

    await Promise.all([
      db.query(
        "INSERT INTO riwayat_ujian (user_id, paket, nomor_to, skor, jml_benar, jml_soal, tgl_selesai) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [userId, sesi.paket, sesi.nomorTO, skor, benar, totalSoal],
      ),
      db.query(
        "UPDATE payments SET status = 'SELESAI' WHERE user_id = ? AND paket = ? AND nomor_to = ? AND status = 'LUNAS'",
        [userId, sesi.paket, sesi.nomorTO],
      ),
      db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [userId]),
    ]);

    delete req.session.ujian;

    req.session.save(() => {
      if (jsonResponse) return res.json({ ok: true, redirect: "/ujian/hasil" });
      res.redirect("/ujian/hasil");
    });
  } catch (err) {
    console.error("Error Simpan Skor:", err);
    res.redirect("/dashboard");
  }
}

// reset-ujian
router.post("/reset-ujian", isLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { paket_pilihan, nomor_to } = req.body; // Ambil nomor_to dari body

  try {
    await db.query(
      "UPDATE payments SET status = 'LUNAS' WHERE user_id = ? AND paket = ? AND nomor_to = ?",
      [userId, paket_pilihan, nomor_to],
    );

    // Hapus jawaban spesifik user untuk paket/TO ini jika ada tabel riwayat detail
    // Jika tabel jawaban_peserta lu global, hati-hati saat menghapus.

    res.redirect("/dashboard?message=Berhasil+Reset+TO+" + nomor_to);
  } catch (err) {
    res.redirect("/dashboard?error=Gagal+Reset");
  }
});

// hasil
router.get("/hasil", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // Ambil riwayat terbaru
    const [rows] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC LIMIT 1",
      [userId],
    );

    if (rows.length === 0) return res.redirect("/dashboard");

    res.render("hasilUjian", {
      skor: rows[0].skor,
      benar: rows[0].jml_benar,
      totalSoal: rows[0].jml_soal,
      user: req.session.user,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/users/dashboardPembayaranUjian");
  }
});

// review
router.get("/review", isLogin, async (req, res) => {
  const { nomor_to } = req.query; // Ambil nomor_to dari URL, misal: /review?nomor_to=1
  const userId = req.session.user.id;

  if (!nomor_to) {
    return res.redirect(
      "/users/dashboardPembayaranUjian?uploadError=" +
        encodeURIComponent("Pilih TO yang ingin di-review."),
    );
  }

  try {
    // Ambil jawaban user + data soal yang di-filter berdasarkan nomor_to
    const [jawabanRows] = await db.query(
      `SELECT 
                jp.question_id,
                jp.jawaban_user,
                q.soal, q.paket, q.materi,
                q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e,
                q.kunci,
                CASE WHEN jp.jawaban_user = q.kunci THEN 1 ELSE 0 END AS is_benar
             FROM jawaban_peserta jp
             JOIN questions q ON jp.question_id = q.id
             WHERE jp.user_id = ? AND q.nomor_to = ?
             ORDER BY q.materi, q.id`,
      [userId, nomor_to],
    );

    if (jawabanRows.length === 0) {
      return res.redirect(
        "/users/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("Tidak ada data untuk TO nomor " + nomor_to),
      );
    }

    // Hitung statistik singkat
    const totalSoal = jawabanRows.length;
    const totalBenar = jawabanRows.filter((j) => j.is_benar).length;
    const totalSalah = totalSoal - totalBenar;
    const skor = Math.round((totalBenar / totalSoal) * 100);

    // Group per materi (TWK, TIU, TKP dll)
    const grouped = {};
    jawabanRows.forEach((j) => {
      if (!grouped[j.materi]) grouped[j.materi] = [];
      grouped[j.materi].push(j);
    });

    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    res.render("reviewJawaban", {
      user: userRows[0],
      grouped,
      totalSoal,
      totalBenar,
      totalSalah,
      skor,
      nomor_to, // Biar di view bisa ditampilin "Review TO #1"
    });
  } catch (err) {
    console.error("ERROR REVIEW:", err);
    res.redirect("/users/dashboardPembayaranUjian?error=Gagal+memuat+review");
  }
});

module.exports = router;
