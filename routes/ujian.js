require("dotenv").config();
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Middleware proteksi
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

function isSedangUjian(req, res, next) {
  if (req.session.isUjianActive) return next();
  return res.redirect("/dashboard");
}

// --- 1. MULAI UJIAN ---
router.post("/mulai", isLogin, async (req, res) => {
  try {
    const { token_input, paket_pilihan } = req.body;
    const userId = req.session.user.id;

    if (!paket_pilihan) {
      return res.send(
        "<script>alert('Pilih paket ujian dulu!'); window.location.href='/dashboard';</script>"
      );
    }

    const [users] = await db.query(
      "SELECT token_ujian, status, status_ujian FROM users WHERE id = ?",
      [userId]
    );
    const user = users[0];

    if (user.status !== "LUNAS") {
      return res.send(
        "<script>alert('Lakukan pembayaran terlebih dahulu!'); window.location.href='/dashboard';</script>"
      );
    }

    if (user.status_ujian === "SELESAI") {
      return res.send(
        "<script>alert('Kamu sudah menyelesaikan ujian ini.'); window.location.href='/dashboard';</script>"
      );
    }

    if (token_input.trim().toUpperCase() !== user.token_ujian.toUpperCase()) {
      return res.send(
        "<script>alert('Token salah!'); window.location.href='/dashboard';</script>"
      );
    }

    await db.query(
      "UPDATE users SET status_ujian = 'SEDANG_UJIAN', waktu_mulai = NOW(), paket_pilihan = ? WHERE id = ?",
      [paket_pilihan, userId]
    );

    req.session.isUjianActive = true;
    res.redirect("/ujian/soal");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memulai ujian.");
  }
});

// --- 2. HALAMAN SOAL ---
router.get("/soal", isLogin, isSedangUjian, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [users] = await db.query(
      `SELECT u.*, p.durasi_menit 
       FROM users u 
       LEFT JOIN paket_ujian p ON u.paket_pilihan = p.nama_paket 
       WHERE u.id = ?`,
      [userId]
    );

    const user = users[0];

    if (!user || user.status_ujian !== "SEDANG_UJIAN") {
      return res.redirect("/dashboard");
    }

    const [daftarSoal] = await db.query(
      `SELECT id, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e 
       FROM questions 
       WHERE paket = ? 
       ORDER BY RAND() 
       LIMIT 100`,
      [user.paket_pilihan]
    );

    res.render("ujian-soal", {
      user,
      soal: daftarSoal,
      durasi: user.durasi_menit || 90,
      waktuMulai: new Date(user.waktu_mulai).getTime(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

// --- 3. SIMPAN JAWABAN (AJAX) ---
router.post("/simpan-jawaban", isLogin, isSedangUjian, async (req, res) => {
  try {
    const { questionId, jawaban } = req.body;
    const userId = req.session.user.id;

    await db.query(
      `INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE jawaban_user = VALUES(jawaban_user)`,
      [userId, questionId, jawaban]
    );

    res.json({ status: "success" });
  } catch (err) {
    console.error("GAGAL SIMPAN JAWABAN:", err);
    res.status(500).json({ status: "error" });
  }
});

// --- 4. SELESAI PAKSA (pindah tab / timeout) ---
router.post("/selesai-paksa", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    await db.query(
      "UPDATE users SET status_ujian = 'SELESAI' WHERE id = ? AND status_ujian = 'SEDANG_UJIAN'",
      [userId]
    );

    req.session.isUjianActive = false;
    res.json({ message: "Ujian dihentikan." });
  } catch (err) {
    console.error("GAGAL SELESAI PAKSA:", err);
    res.status(500).json({ status: "error" });
  }
});

// --- 5. SELESAI NORMAL (scoring) ---
router.post("/selesai", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Pastikan user memang sedang ujian sebelum hitung skor
    const [cek] = await db.query(
      "SELECT status_ujian FROM users WHERE id = ?",
      [userId]
    );
    if (!cek[0] || cek[0].status_ujian !== "SEDANG_UJIAN") {
      return res.status(400).json({ status: "error", message: "Ujian tidak aktif." });
    }

    const [hasil] = await db.query(
      `SELECT 
        UPPER(TRIM(j.jawaban_user)) as jawaban_user, 
        UPPER(TRIM(q.kunci)) as kunci
       FROM jawaban_peserta j
       JOIN questions q ON j.question_id = q.id
       WHERE j.user_id = ?`,
      [userId]
    );

    let skorTotal = 0;
    let benar = 0;
    let salah = 0;
    let kosong = 0;

    hasil.forEach((row) => {
      const jawUser = row.jawaban_user;
      const kunci = row.kunci;

      if (!jawUser || jawUser === "") {
        kosong++;
      } else if (jawUser === kunci) {
        benar++;
        skorTotal += 5;
      } else {
        salah++;
        skorTotal -= 1;
      }
    });

    const skorFinal = Math.max(0, skorTotal);

    console.log(`=== HASIL AKHIR USER ${userId} ===`);
    console.log(`Benar: ${benar}, Salah: ${salah}, Kosong: ${kosong}, Skor: ${skorFinal}`);

    await db.query(
      "UPDATE users SET status_ujian = 'SELESAI', skor = ? WHERE id = ?",
      [skorFinal, userId]
    );

    req.session.isUjianActive = false;
    res.json({ status: "success", skor: skorFinal });
  } catch (err) {
    console.error("ERROR HITUNG SKOR:", err);
    res.status(500).json({ status: "error" });
  }
});

module.exports = router;
