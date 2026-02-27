const express = require("express");
const router = express.Router();
const db = require("../config/db");

function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

function isSedangUjian(req, res, next) {
  if (req.session.ujian) return next();
  res.redirect("/users/dashboardPembayaranUjian");
}

// ─── POST /mulai ────────────────────────────────────
router.post("/mulai", isLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { paket_pilihan, token_input } = req.body;

  try {
    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = userRows[0];

    // 1. Cek apakah sedang aktif ujian (biar gak double session)
    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.redirect("/ujian/soal");
    }

    // 2. Cari payment LUNAS dengan token yang cocok
    // Kita cek statusnya harus 'LUNAS' (berarti belum jadi 'USED')
    const [payments] = await db.query(
      `SELECT * FROM payments 
       WHERE user_id = ? AND paket = ? AND status = 'LUNAS' AND token_ujian = ?
       ORDER BY created_at DESC LIMIT 1`,
      [userId, paket_pilihan, token_input.trim().toUpperCase()]
    );

    // Kalo gak ketemu, berarti antara token salah atau paket ini udah pernah dikerjain (status USED)
    if (!payments.length) {
      return res.send(`<script>alert('Token tidak valid atau paket ini sudah pernah diselesaikan!');window.location.href='/users/dashboardPembayaranUjian';</script>`);
    }

    const payment = payments[0];

    // 3. Ambil config paket
    const [configRows] = await db.query(
      "SELECT durasi_menit AS durasi, jumlah_soal FROM paket_ujian WHERE nama_paket = ? LIMIT 1",
      [paket_pilihan]
    );
    const durasi     = configRows.length ? configRows[0].durasi      : 90;
    const jumlahSoal = configRows.length ? configRows[0].jumlah_soal : 100;

    const [soalList] = await db.query(
      "SELECT id FROM questions WHERE paket = ? AND is_active = 1 ORDER BY RAND() LIMIT ?",
      [paket_pilihan, jumlahSoal]
    );

    if (!soalList.length) {
      return res.send(`<script>alert('Belum ada soal aktif.');window.location.href='/users/dashboardPembayaranUjian';</script>`);
    }

    // 4. Set Session
    req.session.ujian = {
      paket: paket_pilihan,
      paymentId: payment.id,
      soalIds: soalList.map(s => s.id),
      startTime: Date.now(),
      durasiMs: durasi * 60 * 1000,
      jawaban: {},
    };

    // 5. Update status jadi SEDANG_UJIAN
    await db.query(
      "UPDATE users SET status_ujian = 'SEDANG_UJIAN', waktu_mulai = NOW() WHERE id = ?",
      [userId]
    );

    req.session.save(() => {
      res.redirect("/ujian/soal");
    });
  } catch (err) {
    console.error(err);
    res.send(`<script>alert('Terjadi kesalahan sistem.');window.location.href='/users/dashboardPembayaranUjian';</script>`);
  }
});

// ─── GET /soal ──────────────────────────────────────
router.get("/soal", isLogin, isSedangUjian, async (req, res) => {
  try {
    const sesi = req.session.ujian;
    const elapsed = Date.now() - sesi.startTime;

    if (elapsed >= sesi.durasiMs) {
      return res.redirect("/ujian/selesai-paksa");
    }

    const placeholders = sesi.soalIds.map(() => "?").join(",");
    const [soalRows] = await db.query(
      `SELECT * FROM questions WHERE id IN (${placeholders})`,
      sesi.soalIds
    );

    const soalMap = {};
    soalRows.forEach(s => { soalMap[s.id] = s; });
    const soal = sesi.soalIds.map(id => soalMap[id]).filter(Boolean);

    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [req.session.user.id]);

    res.render("ujian-soal", {
      soal,
      user: userRows[0],
      waktuMulai: sesi.startTime,
      durasiMs: sesi.durasiMs,
      jawaban: sesi.jawaban,
      paket: sesi.paket,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan.");
  }
});

// ─── POST /simpan-jawaban ───────────────────────────
router.post("/simpan-jawaban", isLogin, isSedangUjian, async (req, res) => {
  const sesi = req.session.ujian;
  if (Date.now() - sesi.startTime >= sesi.durasiMs) {
    return res.json({ ok: false, expired: true });
  }
  const { questionId, jawaban } = req.body;
  if (questionId && jawaban) {
    sesi.jawaban[questionId] = jawaban;
    req.session.ujian = sesi;
    req.session.save(() => {
      res.json({ ok: true });
    });
  } else {
    res.json({ ok: true });
  }
});

// ─── POST /selesai ─────────────────────────────────
router.post("/selesai", isLogin, async (req, res) => {
  if (!req.session.ujian) {
    return res.json({ ok: false, redirect: "/users/dashboardPembayaranUjian" });
  }
  await hitungDanSimpanSkor(req, res, true);
});

// ─── GET /selesai-paksa ────────────────────────────
router.get("/selesai-paksa", isLogin, async (req, res) => {
  if (!req.session.ujian) return res.redirect("/users/dashboardPembayaranUjian");
  await hitungDanSimpanSkor(req, res, false);
});

// ─── Helper: hitung & simpan skor ──────────────────
async function hitungDanSimpanSkor(req, res, jsonResponse = false) {
  const sesi = req.session.ujian;
  const userId = req.session.user.id;

  try {
    const jawabanUserSesi = sesi.jawaban;
    let benar = 0;

    if (Object.keys(jawabanUserSesi).length > 0) {
      const soalIds = Object.keys(jawabanUserSesi);
      const placeholders = soalIds.map(() => "?").join(",");
      const [soalRows] = await db.query(
        `SELECT id, kunci FROM questions WHERE id IN (${placeholders})`,
        soalIds
      );
      for (const s of soalRows) {
        if (jawabanUserSesi[s.id] === s.kunci) benar++;
      }
    }

    const totalSoal = sesi.soalIds.length;
    const skor = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;

    for (const [soalId, jwb] of Object.entries(jawabanUserSesi)) {
      await db.query(
        `INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE jawaban_user = VALUES(jawaban_user)`,
        [userId, soalId, jwb]
      );
    }

    // Ubah status user kembali ke SELESAI
    await db.query(
      "UPDATE users SET status_ujian = 'SELESAI', skor = ?, tgl_selesai_ujian = NOW() WHERE id = ?",
      [skor, userId]
    );

    // Tandai payment ini sudah dipakai, biar token ini gak bisa dipake mulai ujian lagi
    await db.query("UPDATE payments SET status = 'USED' WHERE id = ?", [sesi.paymentId]);

    delete req.session.ujian;
    req.session.save(() => {
      if (jsonResponse) {
        return res.json({ ok: true, redirect: `/ujian/hasil?skor=${skor}&benar=${benar}&total=${totalSoal}` });
      }
      res.render("hasilUjian", { skor, benar, totalSoal, paket: sesi.paket });
    });
  } catch (err) {
    console.error("Error Simpan Skor:", err);
    delete req.session.ujian;
    req.session.save(() => {
      if (jsonResponse) return res.json({ ok: false, redirect: "/users/dashboardPembayaranUjian" });
      res.redirect("/users/dashboardPembayaranUjian");
    });
  }
}

// ─── GET /hasil ─────────────────────────────────────
router.get("/hasil", isLogin, async (req, res) => {
  const skor = parseInt(req.query.skor) || 0;
  const benar = parseInt(req.query.benar) || 0;
  const totalSoal = parseInt(req.query.total) || 0;
  res.render("hasilUjian", { skor, benar, totalSoal, paket: "Ujian Selesai" });
});

module.exports = router;