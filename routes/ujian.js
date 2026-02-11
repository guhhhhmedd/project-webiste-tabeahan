const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/mulai", async (req, res) => {
  console.log("ISI REQ.BODY:", req.body);

  try {
    const { token_input } = req.body;
    const userId = req.session.user ? req.session.user.id : null;

    try {
      const [rows] = await db.query(
        "SELECT token_ujian FROM users WHERE id = ?",
        [userId],
      );
      const tokenAsli = rows[0].token_ujian;
      if (token_input.toUpperCase() !== tokenAsli.toUpperCase()) {
        return res.send(
          "<script>alert('Token Salah! Silakan cek kembali.'); window.location.href='/dashboard';</script>",
        );
      }
      res.redirect("/ujian/soal");
    } catch (err) {
      res.status(500).send("Gagal memvalidasi token.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error Server");
  }
});

router.get("/soal", async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login");

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    const user = users[0];

    if (!user || user.status_ujian !== "SEDANG_UJIAN") {
      return res.redirect("/dashboard");
    }

    const [daftarSoal] = await db.query(`
            SELECT id, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, bobot_nilai 
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

    hasil.forEach((row) => {
      if (row.jawaban_user === row.kunci) {
        benar++;
        skorTotal += 5;
      } else {
        salah++;
        skorTotal -= 1;
      }
    });

    // Skor minimum 0
    const skorFinal = skorTotal < 0 ? 0 : skorTotal;

    console.log(`=== HASIL AKHIR USER ${userId} ===`);
    console.log(`Benar: ${benar}, Salah: ${salah}, Total Skor: ${skorFinal}`);
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
