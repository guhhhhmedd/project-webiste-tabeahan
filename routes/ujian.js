require("dotenv").config();
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// --- 1. ROUTE MULAI UJIAN ---
router.post("/mulai", async (req, res) => {
  try {
    const { token_input, paket_pilihan } = req.body; // Ambil paket_pilihan dari dropdown dashboard
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) return res.redirect("/login");

    // Pastikan user memilih paket
    if (!paket_pilihan) {
      return res.send(
        "<script>alert('Pilih paket ujian dulu, Bre!'); window.location.href='/dashboard';</script>",
      );
    }

    // 1. Ambil data user
    const [users] = await db.query(
      "SELECT token_ujian, status, status_ujian FROM users WHERE id = ?",
      [userId],
    );
    const user = users[0];

    // 2. Validasi Pembayaran & Token
    if (user.status !== "LUNAS") {
      return res.send(
        "<script>alert('Bayar dulu Le!'); window.location.href='/dashboard';</script>",
      );
    }

    if (token_input.trim().toUpperCase() !== user.token_ujian.toUpperCase()) {
      return res.send(
        "<script>alert('Token Salah!'); window.location.href='/dashboard';</script>",
      );
    }

    // 3. SET STATUS & PAKET: Simpan paket yang dipilih user ke tabel users
    await db.query(
      "UPDATE users SET status_ujian = 'SEDANG_UJIAN', waktu_mulai = NOW(), paket_pilihan = ? WHERE id = ?",
      [paket_pilihan, userId],
    );

    req.session.isUjianActive = true;
    res.redirect("/ujian/soal");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memulai ujian.");
  }
});

// --- 2. ROUTE HALAMAN SOAL ---
router.get("/soal", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login");

    // Ambil data user DAN durasi dari tabel paket_ujian berdasarkan paket_pilihan user
    const [users] = await db.query(
      `SELECT u.*, p.durasi_menit 
       FROM users u 
       LEFT JOIN paket_ujian p ON u.paket_pilihan = p.nama_paket 
       WHERE u.id = ?`,
      [userId],
    );

    const user = users[0];

    // Proteksi status ujian
    if (!user || user.status_ujian !== "SEDANG_UJIAN") {
      return res.redirect("/dashboard");
    }

    // AMBIL SOAL SESUAI PAKET USER (Limit 100 soal acak)
    const [daftarSoal] = await db.query(
      `SELECT id, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e 
       FROM questions 
       WHERE paket = ? 
       ORDER BY RAND() 
       LIMIT 100`,
      [user.paket_pilihan],
    );

    res.render("ujian-soal", {
      user: user,
      soal: daftarSoal,
      durasi: user.durasi_menit || 90, // default 90 jika durasi tidak ditemukan
      waktuMulai: new Date(user.waktu_mulai).getTime(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

// --- 3. SIMPAN JAWABAN (AJAX) ---
router.post("/simpan-jawaban", async (req, res) => {
  try {
    const { questionId, jawaban } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) return res.status(401).json({ status: "error" });

    const query = `
        INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE jawaban_user = VALUES(jawaban_user)
    `;

    await db.query(query, [userId, questionId, jawaban]);
    res.json({ status: "success" });
  } catch (err) {
    console.error("GAGAL SIMPAN JAWABAN:", err);
    res.status(500).json({ status: "error" });
  }
});

// --- 4. SELESAI PAKSA (Jika pindah tab/curang) ---
router.post("/selesai-paksa", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.status(401).json({ status: "error" });

    await db.query("UPDATE users SET status_ujian = 'SELESAI' WHERE id = ?", [userId]);

    req.session.isUjianActive = false;
    res.json({ message: "Ujian dihentikan paksa" });
  } catch (err) {
    console.error("GAGAL SELESAI PAKSA:", err);
    res.status(500).json({ status: "error" });
  }
});

// --- 5. ROUTE SELESAI NORMAL (Scoring) ---
router.post("/selesai", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.status(401).json({ status: "error" });

    const [hasil] = await db.query(
      `SELECT 
        UPPER(TRIM(j.jawaban_user)) as jawaban_user, 
        UPPER(TRIM(q.kunci)) as kunci
       FROM jawaban_peserta j
       JOIN questions q ON j.question_id = q.id
       WHERE j.user_id = ?`,
      [userId],
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
    console.log(`B: ${benar}, S: ${salah}, K: ${kosong}, Total: ${skorFinal}`);

    await db.query(
      "UPDATE users SET status_ujian = 'SELESAI', skor = ? WHERE id = ?",
      [skorFinal, userId],
    );

    req.session.isUjianActive = false;
    res.json({ status: "success", skor: skorFinal });
  } catch (err) {
    console.error("ERROR HITUNG SKOR:", err);
    res.status(500).json({ status: "error" });
  }
});

module.exports = router;