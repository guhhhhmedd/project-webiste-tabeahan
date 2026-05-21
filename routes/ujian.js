const express = require("express");
const router = express.Router();
const db = require("../config/db");

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


// KONSTANTA
const DEFAULT_BOBOT_BENAR = 500;

const PASSING_GRADE = {
  'Paket SKD/TKD': {
    type: 'PER_SUBTEST',
    perSubtest: { 1: 65, 2: 80, 3: 166 },
    kumulatif: 311,
    skorMaksTotal: 550,
  },
  'Paket Akademik Polri': {
    type: 'PERSENTASE',
    minPersen: 70,
    skorMaksTotal: 125,
  },
  'Paket PPPK': {
    type:'PERINGKAT',
    skorMaksTotal: 670,
  },
};

// POST /ujian/mulai
router.post("/mulai", isLogin, async (req, res) => {
  const { paket_pilihan, nomor_to } = req.body;
  const userId = req.session.user.id;

  try {
    const [payment] = await db.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ? AND UPPER(status) = 'LUNAS'
         AND created_at >= NOW() - INTERVAL 7 DAY`,
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
      "SELECT durasi_menit FROM paket_ujian WHERE TRIM(nama_paket) = TRIM(?) LIMIT 1",
      [paket_pilihan]
    );
    const durasiMs = (config[0]?.durasi_menit || 100) * 60 * 1000;

    const [questions] = await db.query(
      `SELECT id FROM questions
       WHERE TRIM(paket) = TRIM(?) AND nomor_to = ? AND is_active = 1
       ORDER BY materi_id ASC, nomor_urut ASC`,
      [paket_pilihan, parseInt(nomor_to)]
    );

    const flatSoalIds = questions.map(q => q.id);

    req.session.ujian = {
      paymentId,
      paket: paket_pilihan,
      nomorTO: parseInt(nomor_to),
      soalIds: flatSoalIds,
      jawaban: {},
      startTime: Date.now(),
      durasiMs,
    };

    await db.query("UPDATE users SET status_ujian = 'SEDANG_UJIAN' WHERE id = ?", [userId]);

    res.redirect("/ujian/soal/1");
  } catch (err) {
    console.error("Error /mulai:", err);
    res.status(500).send("Gagal memulai ujian.");
  }
});


// GET /ujian/soal/:index
router.get("/soal/:index", isLogin, isSedangUjian, async (req, res) => {
  const sesi         = req.session.ujian;
  const currentIndex = parseInt(req.params.index) - 1;
  const userId       = req.session.user.id;

  if (Date.now() - sesi.startTime >= sesi.durasiMs) {
    return res.redirect("/ujian/selesai-paksa");
  }

  try {
    if (!sesi.soalIds || sesi.soalIds.length === 0 || currentIndex < 0 || currentIndex >= sesi.soalIds.length) {
      await db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [userId]);
      delete req.session.ujian;
      return req.session.save(() => res.redirect("/dashboardPembayaranUjian"));
    }

    const [allSoalRows] = await db.query(
      `SELECT q.*, COALESCE(m.nama_materi, q.materi_id) AS materi
       FROM questions q
       LEFT JOIN materi_list m ON q.materi_id = m.id
       WHERE q.id IN (?)
       ORDER BY FIELD(q.id, ?)`,
      [sesi.soalIds, sesi.soalIds]
    );

    if (allSoalRows.length === 0) {
      await db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [userId]);
      delete req.session.ujian;
      return req.session.save(() => {
        res.send(`<script>
          alert('Soal tidak ditemukan di database! Status ujian direset.');
          window.location.href='/dashboardPembayaranUjian';
        </script>`);
      });
    }

    const sisaWaktuMs = (sesi.startTime + sesi.durasiMs) - Date.now();

    res.render("ujian-soal", {
      soal: allSoalRows,
      currentIndex: currentIndex + 1,
      totalSoal: sesi.soalIds.length,
      jawaban: sesi.jawaban,
      sisaWaktuMs: Math.max(sisaWaktuMs, 0),
      paket: sesi.paket,
      nomorTO: sesi.nomorTO,
      user: req.session.user,
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
    // 1. Ambil semua soal beserta bobot & materi
    const [soalRows] = await db.query(
      `SELECT q.id, q.kunci, q.tipe_penilaian,
              q.bobot_a, q.bobot_b, q.bobot_c, q.bobot_d, q.bobot_e,
              q.materi_id,
              COALESCE(m.nama_materi, CONCAT('Materi ', q.materi_id)) AS nama_materi,
              COALESCE(m.bobot_benar, 0) AS bobot_benar_materi
       FROM questions q
       LEFT JOIN materi_list m ON q.materi_id = m.id
       WHERE TRIM(q.paket) = TRIM(?) AND q.nomor_to = ? AND q.is_active = 1`,
      [sesi.paket, sesi.nomorTO]
    );

    if (!soalRows || soalRows.length === 0) {
      delete req.session.ujian;
      return req.session.save(() => {
        if (jsonResponse) return res.json({ ok: false, redirect: '/dashboardPembayaranUjian' });
        res.redirect('/dashboardPembayaranUjian');
      });
    }

    const jawabanUserSesi = sesi.jawaban || {};
    const skorPerMateri = {};
    let totalPoin = 0;
    let totalBenar = 0;
    const valuesJawaban = [];

    soalRows.forEach((s) => {
      const mid = s.materi_id || 0;
      const jawabanUser = (jawabanUserSesi[s.id] || '').toLowerCase();
      const kunci = (s.kunci || '').toLowerCase();

      if (!skorPerMateri[mid]) {
        skorPerMateri[mid] = {
          materi_id: mid || null,
          nama: s.nama_materi || `Materi ${mid}`,
          skor: 0,
          maks: 0,
          benar: 0,
          total: 0,
        };
      }
      skorPerMateri[mid].total++;

      if (s.tipe_penilaian === 'BOBOT_OPSI') {
        const maxBobot = Math.max(
          ...[s.bobot_a, s.bobot_b, s.bobot_c, s.bobot_d, s.bobot_e].map(Number)
        );
        skorPerMateri[mid].maks += maxBobot;

        if (jawabanUser) {
          const bobotOpsi = Number(s['bobot_' + jawabanUser]) || 0;
          skorPerMateri[mid].skor  += bobotOpsi;
          skorPerMateri[mid].benar++;
          totalPoin  += bobotOpsi;
          totalBenar++;
        }
      } else {
        const bb = (s.bobot_benar_materi && s.bobot_benar_materi > 0)
          ? s.bobot_benar_materi / 100
          : DEFAULT_BOBOT_BENAR / 100;

        skorPerMateri[mid].maks += bb;

        if (jawabanUser && jawabanUser === kunci) {
          skorPerMateri[mid].skor  += bb;
          skorPerMateri[mid].benar++;
          totalPoin  += bb;
          totalBenar++;
        }
      }

      valuesJawaban.push([userId, sesi.paket, sesi.nomorTO, s.id, jawabanUser || null]);
    });

    if (valuesJawaban.length > 0) {
      await db.query(
        `INSERT INTO jawaban_peserta (user_id, paket, nomor_to, question_id, jawaban_user)
         VALUES ?
         ON DUPLICATE KEY UPDATE jawaban_user = VALUES(jawaban_user)`,
        [valuesJawaban]
      );
    }

    const totalSoal = soalRows.length;
    const skor = Math.round(totalPoin);

    const [riwayatResult] = await db.query(
      `INSERT INTO riwayat_ujian (user_id, paket, nomor_to, skor, jml_benar, jml_soal, tgl_selesai)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, sesi.paket, sesi.nomorTO, skor, totalBenar, totalSoal]
    );
    const riwayatUjianId = riwayatResult.insertId;

    const valuesSubtest = Object.values(skorPerMateri).map((sub) => [
      riwayatUjianId,
      sub.materi_id,
      sub.nama,
      sub.total,                          // jumlah_soal
      sub.benar,                          // jumlah_benar
      sub.total - sub.benar,              // jumlah_salah
      Math.round(sub.skor * 100) / 100,   // skor_subtest
      Math.round(sub.maks * 100) / 100,   // skor_maks
    ]);

    if (valuesSubtest.length > 0) {
      await db.query(
        `INSERT INTO riwayat_subtest
           (riwayat_ujian_id, materi_id, nama_materi,
            jumlah_soal, jumlah_benar, jumlah_salah,
            skor_subtest, skor_maks)
         VALUES ?`,
        [valuesSubtest]
      );
    }

    // 6. Reset status ujian user
    await db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [userId]);

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
      db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [userIdTarget]),
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

    // Riwayat ujian terbaru
    const [riwayatRows] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? ORDER BY tgl_selesai DESC LIMIT 1",
      [userId]
    );
    if (riwayatRows.length === 0) return res.redirect("/dashboardPembayaranUjian");
    const riwayat = riwayatRows[0];

    const [subtestRows] = await db.query(
      `SELECT
         id,
         riwayat_ujian_id,
         materi_id,
         nama_materi,
         skor_subtest,
         skor_maks,
         jumlah_soal  AS jml_soal,
         jumlah_benar AS jml_benar,
         jumlah_salah
       FROM riwayat_subtest
       WHERE riwayat_ujian_id = ?
       ORDER BY materi_id ASC`,
      [riwayat.id]
    );

    // Logika passing grade
    const pg = PASSING_GRADE[riwayat.paket] || { type: 'PERINGKAT', skorMaksTotal: 0 };
    let statusKelulusan = 'PERINGKAT';
    let nilaiAkhir      = null;
    let subtestData     = subtestRows;

    if (pg.type === 'PER_SUBTEST') {
      let semuaLulus = true;
      subtestData = subtestRows.map((sub) => {
        const minSkor = pg.perSubtest[sub.materi_id] || 0;
        const lulus   = sub.skor_subtest >= minSkor;
        if (!lulus) semuaLulus = false;
        return { ...sub, min_skor: minSkor, lulus };
      });
      const lulusKumulatif = riwayat.skor >= pg.kumulatif;
      statusKelulusan = (semuaLulus && lulusKumulatif) ? 'LULUS' : 'TIDAK_LULUS';

    } else if (pg.type === 'PERSENTASE') {
      nilaiAkhir = riwayat.jml_soal > 0
        ? Math.round((riwayat.jml_benar / riwayat.jml_soal) * 1000) / 10
        : 0;
      statusKelulusan = 'INFO';
    }

    res.render("hasilUjian", {
      skor: riwayat.skor,
      benar: riwayat.jml_benar,
      totalSoal: riwayat.jml_soal,
      paket: riwayat.paket,
      nomorTO: riwayat.nomor_to,
      user: req.session.user,
      subtestData,
      statusKelulusan,
      pgConfig:        pg,
      nilaiAkhir,
    });
  } catch (err) {
    console.error("Error /hasil:", err);
    res.redirect("/dashboardPembayaranUjian");
  }
});


// GET /ujian/review

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
         q.soal, q.paket, q.nomor_to, q.nomor_urut,
         q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e,
         q.kunci, q.pembahasan, q.tipe_penilaian,
         q.bobot_a, q.bobot_b, q.bobot_c, q.bobot_d, q.bobot_e,
         q.gambar, q.gambar_a, q.gambar_b, q.gambar_c, q.gambar_d, q.gambar_e,
         q.gambar_pembahasan,
         q.materi_id,
         COALESCE(m.nama_materi, CONCAT('Subtest ', q.materi_id)) AS nama_materi,
         CASE
           WHEN q.tipe_penilaian = 'BOBOT_OPSI'
                AND jp.jawaban_user IS NOT NULL
                AND jp.jawaban_user != '' THEN 1
           WHEN LOWER(jp.jawaban_user) = LOWER(q.kunci) THEN 1
           ELSE 0
         END AS is_benar
       FROM jawaban_peserta jp
       JOIN questions q ON jp.question_id = q.id
       LEFT JOIN materi_list m ON q.materi_id = m.id
       WHERE jp.user_id = ?
         AND TRIM(jp.paket) = TRIM(?)
         AND jp.nomor_to = ?
       ORDER BY q.materi_id ASC, q.nomor_urut ASC`,
      [userId, paket || "", nomor_to]
    );

    if (jawabanRows.length === 0) {
      return res.redirect(
        "/dashboardPembayaranUjian?uploadError=" +
          encodeURIComponent("Tidak ada data review untuk TO #" + nomor_to)
      );
    }

    const [riwayat] = await db.query(
      "SELECT * FROM riwayat_ujian WHERE user_id = ? AND nomor_to = ? ORDER BY tgl_selesai DESC LIMIT 1",
      [userId, nomor_to]
    );

    const [paymentRows] = await db.query(
      `SELECT created_at FROM payments
       WHERE user_id = ? AND TRIM(paket) = TRIM(?) AND nomor_to = ? AND UPPER(status) = 'LUNAS'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, paket || riwayat[0]?.paket || "", nomor_to]
    );

    let sisaWaktuText = "";
    if (paymentRows.length > 0 && paymentRows[0].created_at) {
      const diff = (new Date(paymentRows[0].created_at).getTime() + 7 * 24 * 60 * 60 * 1000) - Date.now();
      if (diff > 0) {
        const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        sisaWaktuText = days > 0 ? `${days} hari ${hours} jam` : `${hours} jam`;
      } else {
        sisaWaktuText = "Kadaluarsa";
      }
    }

    const totalSoal  = jawabanRows.length;
    const totalBenar = riwayat[0]?.jml_benar ?? jawabanRows.filter(j => j.is_benar).length;
    const totalSalah = totalSoal - totalBenar;
    const skor       = riwayat[0]?.skor ?? Math.round((totalBenar / totalSoal) * 100);

    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);

    res.render("reviewJawaban", {
      user:         userRows[0],
      soalRows:     jawabanRows,
      totalSoal,
      totalBenar,
      totalSalah,
      skor,
      nomor_to,
      paket:        riwayat[0]?.paket || paket || "",
      tglSelesai:   riwayat[0]?.tgl_selesai || null,
      sisaWaktuText,
    });
  } catch (err) {
    console.error("ERROR /review:", err);
    res.redirect("/dashboardPembayaranUjian?error=Gagal+memuat+review");
  }
});


module.exports = router;