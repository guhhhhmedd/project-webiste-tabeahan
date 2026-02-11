const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/mulai", async (req, res) => {
  try {
    const { token_input } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    if (!userId) return res.redirect("/login");

    // 1. Ambil data user
    const [users] = await db.query(
      "SELECT token_ujian, status, status_ujian FROM users WHERE id = ?",
      [userId],
    );
    const user = users[0];

    // 2. Validasi: Apakah sudah bayar? Apakah token benar?
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

    // 3. SET STATUS: Penting biar bisa masuk ke halaman soal
    // Kita set waktu_mulai sekarang dan status_ujian
    await db.query(
      "UPDATE users SET status_ujian = 'SEDANG_UJIAN', waktu_mulai = NOW() WHERE id = ?",
      [userId],
    );

    res.redirect("/ujian/soal");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memulai ujian.");
  }
});

router.get("/soal", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login");

    // Ambil data user terbaru
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    const user = users[0];

    // Proteksi: Kalau statusnya bukan SEDANG_UJIAN, tendang balik
    if (user.status_ujian !== "SEDANG_UJIAN") {
      return res.redirect("/dashboard");
    }

    // Ambil 50 Soal Acak
    // Pastikan nama kolom sesuai: id, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e
    const [daftarSoal] = await db.query(`
        SELECT id, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e 
        FROM questions 
        ORDER BY RAND() 
        LIMIT 50
    `);

    res.render("ujian-soal", {
      user: user,
      soal: daftarSoal,
      waktuMulai: user.waktu_mulai,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

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

    console.log(
      `Jawaban User ${userId} untuk soal ${questionId} disimpan: ${jawaban}`,
    );
    res.json({ status: "success" });
  } catch (err) {
    console.error(" GAGAL SIMPAN JAWABAN:", err);
    res.status(500).json({ status: "error" });
  }
});

// Route Selesai (Logika Scoring -1, +5, 0)
router.post("/selesai", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.status(401).json({ status: "error" });

    const [hasil] = await db.query(
      `
            SELECT 
                UPPER(TRIM(j.jawaban_user)) as jawaban_user, 
                UPPER(TRIM(q.kunci)) as kunci
            FROM jawaban_peserta j
            JOIN questions q ON j.question_id = q.id
            WHERE j.user_id = ?
            `,
      [userId],
    );

    let skorTotal = 0;
    let benar = 0;
    let salah = 0;
    let kosong = 0;

    hasil.forEach((row) => {
      // Jika jawaban kosong atau null
      if (!row.jawaban_user || row.jawaban_user === "") {
        kosong++;
        // Tidak ditambah, tidak dikurangi
      }
      // Jika jawaban Benar
      else if (row.jawaban_user === row.kunci) {
        benar++;
        skorTotal += 5;
      }
      // Jika jawaban Salah (Ada isinya tapi tidak sama dengan kunci)
      else {
        salah++;
        skorTotal -= 1;
      }
    });

    // Skor minimum 0 biar gak minus
    const skorFinal = Math.max(0, skorTotal);

    console.log(`=== HASIL AKHIR USER ${userId} ===`);
    console.log(`B: ${benar}, S: ${salah}, K: ${kosong}, Total: ${skorFinal}`);

    await db.query(
      "UPDATE users SET status_ujian = 'SELESAI', skor = ? WHERE id = ?",
      [skorFinal, userId],
    );

    res.json({ status: "success", skor: skorFinal });
  } catch (err) {
    console.error("ERROR HITUNG SKOR:", err);
    res.status(500).json({ status: "error" });
  }
});

module.exports = router;
