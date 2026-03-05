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
            [req.session.user.id]
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
    const { paket_pilihan } = req.body;
    const userId = req.session.user.id;

    try {
        // 1. Ambil data payment & sisa kuota
        const [payment] = await db.query(
            `SELECT id, sisa_kuota FROM payments 
             WHERE user_id = ? AND paket = ? AND status = 'LUNAS' 
             AND (expired_at > NOW() OR expired_at IS NULL) AND sisa_kuota > 0`,
            [userId, paket_pilihan]
        );

        if (payment.length === 0) {
            return res.send("<script>alert('Kuota habis atau akses expired!'); window.location.href='/dashboard';</script>");
        }

        // 2. Ambil konfigurasi durasi dari tabel paket_ujian
        const [config] = await db.query("SELECT durasi_menit FROM paket_ujian WHERE nama_paket = ?", [paket_pilihan]);
        const durasiMenit = config.length > 0 ? config[0].durasi_menit : 100; // default 100 mnt

        // 3. Tentukan nomor TO (Misal kuota 10, sisa 10 -> TO 1. Sisa 9 -> TO 2)
        const totalKuotaAwal = 10; 
        const nomorTO = (totalKuotaAwal - payment[0].sisa_kuota) + 1;

        // 4. Ambil soal berdasarkan paket & nomor_to, urutkan sesuai materi_list
        const [soal] = await db.query(
            `SELECT q.id FROM questions q
             JOIN materi_list m ON q.materi_id = m.id
             WHERE q.paket = ? AND q.nomor_to = ? AND q.is_active = 1
             ORDER BY m.urutan_materi ASC, q.nomor_urut ASC`,
            [paket_pilihan, nomorTO]
        );

        if (soal.length === 0) {
            return res.send(`<script>alert('Soal untuk ${paket_pilihan} TO ${nomorTO} belum tersedia!'); window.location.href='/dashboard';</script>`);
        }

        // 5. Kurangi kuota saat mulai (Optional: atau kurangi saat selesai)
        await db.query("UPDATE payments SET sisa_kuota = sisa_kuota - 1 WHERE id = ?", [payment[0].id]);

        // 6. Set Session
        req.session.ujian = {
            paymentId: payment[0].id,
            paket: paket_pilihan,
            nomorTO: nomorTO,
            soalIds: soal.map(s => s.id),
            jawaban: {},
            startTime: Date.now(),
            durasiMs: durasiMenit * 60 * 1000 // SEKARANG DURASI ADA DI SINI
        };

        res.redirect("/ujian/soal/1"); 

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
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
        const [soalRow] = await db.query("SELECT * FROM questions WHERE id = ?", [currentSoalId]);
        
        res.render("ujian-soal", {
            soal: soalRow[0],
            currentIndex: index + 1,
            totalSoal: sesi.soalIds.length,
            jawaban: sesi.jawaban,
            waktuMulai: sesi.startTime,
            durasiMs: sesi.durasiMs,
            paket: sesi.paket,
            nomorTO: sesi.nomorTO
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
    if (!req.session.ujian) return res.json({ ok: false, redirect: "/users/dashboardPembayaranUjian" });
    await hitungDanSimpanSkor(req, res, true);
});

router.get("/selesai-paksa", isLogin, async (req, res) => {
    if (!req.session.ujian) return res.redirect("/users/dashboardPembayaranUjian");
    await hitungDanSimpanSkor(req, res, false);
});

//  HITUNG SKOR 
async function hitungDanSimpanSkor(req, res, jsonResponse = false) {
    const sesi = req.session.ujian;
    const userId = req.session.user.id;

    try {
        const jawabanUserSesi = sesi.jawaban; // { questionId: 'a', ... }
        let benar = 0;
        const soalIds = sesi.soalIds;

        const [soalRows] = await db.query(
            "SELECT id, kunci FROM questions WHERE id IN (?)",
            [soalIds]
        );

        for (const s of soalRows) {
            if (jawabanUserSesi[s.id] === s.kunci) benar++;
        }

        const totalSoal = soalIds.length;
        const skor = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;

        // Simpan jawaban ke jawaban_peserta (untuk fitur review)
        // Hapus dulu jawaban lama lalu insert semua sekaligus
        await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);

        const jawabanEntries = Object.entries(jawabanUserSesi);
        if (jawabanEntries.length > 0) {
            const values = jawabanEntries.map(([qId, jwb]) => [userId, parseInt(qId), jwb]);
            await db.query(
                "INSERT INTO jawaban_peserta (user_id, question_id, jawaban_user) VALUES ?",
                [values]
            );
        }

        // Hitung percobaan ke berapa untuk paket ini 
        const [countRows] = await db.query(
            "SELECT COUNT(*) as cnt FROM riwayat_ujian WHERE user_id = ? AND paket = ?",
            [userId, sesi.paket]
        );
        const percobaan_ke = (countRows[0].cnt || 0) + 1;

        await db.query(
            "INSERT INTO riwayat_ujian (user_id, paket, skor, jml_benar, jml_soal, tgl_selesai, percobaan_ke) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
            [userId, sesi.paket, skor, benar, totalSoal, percobaan_ke]
        );

        await db.query(
            "UPDATE users SET status_ujian = 'IDLE', skor = ?, jml_benar = ?, jml_soal = ?, tgl_selesai_ujian = NOW() WHERE id = ?",
            [skor, benar, totalSoal, userId]
        );

        // Hapus sesi agar tidak loop
        delete req.session.ujian;

        req.session.save(() => {
            if (jsonResponse) return res.json({ ok: true, redirect: "/ujian/hasil" });
            res.redirect("/ujian/hasil");
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

// reset-ujian 
router.post("/reset-ujian", isLogin, async (req, res) => {
    const userId = req.session.user.id;
    const { paket_pilihan } = req.body;

    try {
        const [payRows] = await db.query(
            `SELECT id, token_ujian, expired_at, status FROM payments
             WHERE user_id = ? AND paket = ? AND status IN ('USED', 'LUNAS', 'EXPIRED')
             ORDER BY created_at DESC LIMIT 1`,
            [userId, paket_pilihan]
        );

        if (payRows.length === 0) {
            return res.redirect("/users/dashboardPembayaranUjian?uploadError=" + encodeURIComponent("Tidak ditemukan akses paket untuk di-reset."));
        }

        const pay = payRows[0];

        // Generate token baru (8 karakter hex uppercase)
        const crypto = require("crypto");
        const tokenBaru = crypto.randomBytes(4).toString("hex").toUpperCase();
        await db.query(
            "UPDATE payments SET status = 'LUNAS', token_ujian = ?, expired_at = NULL WHERE id = ?",
            [tokenBaru, pay.id]
        );
        await db.query(
            "UPDATE users SET status_ujian = 'IDLE', skor = 0, jml_benar = 0, jml_soal = 0, waktu_mulai = NULL, tgl_selesai_ujian = NULL WHERE id = ?",
            [userId]
        );

        await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);

        if (req.session.ujian) delete req.session.ujian;

        req.session.save(() => {
            res.redirect("/users/dashboardPembayaranUjian?success=" + encodeURIComponent(
                "Reset berhasil! Token ujian baru untuk " + paket_pilihan + " adalah: " + tokenBaru + ". Soal akan diacak ulang."
            ));
        });

    } catch (err) {
        console.error("ERROR RESET UJIAN:", err);
        res.redirect("/users/dashboardPembayaranUjian?uploadError=" + encodeURIComponent("Gagal reset ujian, silakan coba lagi."));
    }
});

// hasil 
router.get("/hasil", isLogin, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT skor, status_ujian FROM users WHERE id = ?",
            [req.session.user.id]
        );

        if (rows.length === 0) {
            return res.redirect("/users/dashboardPembayaranUjian");
        }

        res.render("hasilUjian", { 
            skor: rows[0].skor,
            benar: Math.round((rows[0].skor / 100) * 100), 
            totalSoal: 100, 
            user: req.session.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect("/users/dashboardPembayaranUjian");
    }
});

// review 
router.get("/review", isLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Ambil jawaban user + data soal lengkap sekaligus
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
             WHERE jp.user_id = ?
             ORDER BY q.paket, q.materi, q.id`,
            [userId]
        );

        if (jawabanRows.length === 0) {
            return res.redirect("/users/dashboardPembayaranUjian?uploadError=" +
                encodeURIComponent("Tidak ada data jawaban untuk di-review. Selesaikan ujian terlebih dahulu."));
        }

        // Hitung statistik
        const totalSoal  = jawabanRows.length;
        const totalBenar = jawabanRows.filter(j => j.is_benar).length;
        const totalSalah = totalSoal - totalBenar;
        const skor       = Math.round((totalBenar / totalSoal) * 100);

        // Group per paket → materi
        const grouped = {};
        jawabanRows.forEach(j => {
            if (!grouped[j.paket])          grouped[j.paket] = {};
            if (!grouped[j.paket][j.materi]) grouped[j.paket][j.materi] = [];
            grouped[j.paket][j.materi].push(j);
        });

        const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);

        res.render("reviewJawaban", {
            user:       userRows[0],
            grouped,
            totalSoal,
            totalBenar,
            totalSalah,
            skor,
        });

    } catch (err) {
        console.error("ERROR REVIEW:", err);
        res.redirect("/users/dashboardPembayaranUjian?uploadError=" +
            encodeURIComponent("Gagal memuat review jawaban."));
    }
});

module.exports = router;