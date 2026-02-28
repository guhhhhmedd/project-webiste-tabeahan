const express = require("express");
const router = express.Router();
const db = require("../config/db");

// --- MIDDLEWARE ---
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

// ─── POST /mulai ────────────────────────────────────
router.post("/mulai", isLogin, async (req, res) => {
    const userId = req.session.user.id;
    const { paket_pilihan, token_input } = req.body;

    try {
        // 1. Cek Pembayaran & Token
        const [activePayment] = await db.query(
            `SELECT id, expired_at FROM payments WHERE user_id = ? AND paket = ? AND status = 'LUNAS' AND (expired_at > NOW() OR expired_at IS NULL) LIMIT 1`,
            [userId, paket_pilihan]
        );

        if (activePayment.length === 0) {
            return res.send(`<script>alert('Akses paket tidak ditemukan atau belum lunas!');window.location.href='/users/dashboardPembayaranUjian';</script>`);
        }

        const pay = activePayment[0];

        // 2. Aktivasi Token Jika Belum
        if (!pay.expired_at) {
            const [tokenCheck] = await db.query(
                `SELECT id FROM payments WHERE id = ? AND token_ujian = ?`,
                [pay.id, token_input ? token_input.trim().toUpperCase() : ""]
            );

            if (tokenCheck.length === 0) {
                return res.send(`<script>alert('Token aktivasi salah!');window.location.href='/users/dashboardPembayaranUjian';</script>`);
            }

            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() + 60);
            await db.query("UPDATE payments SET expired_at = ? WHERE id = ?", [expiredDate, pay.id]);
        }

        // 3. ANTI-DOUBLE SESSION (Ditingkatkan)
        const [userStatus] = await db.query("SELECT status_ujian FROM users WHERE id = ?", [userId]);
        if (userStatus[0].status_ujian === 'SEDANG_UJIAN') {
            if (req.session.ujian) {
                return res.redirect("/ujian/soal");
            } else {
                // Reset status jika session hilang tapi DB masih nyangkut
                await db.query("UPDATE users SET status_ujian = 'BELUM_UJIAN' WHERE id = ?", [userId]);
            }
        }

        // 4. Ambil Config & Soal
        const [config] = await db.query("SELECT durasi_menit, jumlah_soal FROM paket_ujian WHERE nama_paket = ? LIMIT 1", [paket_pilihan]);
        const durasi = config.length ? config[0].durasi_menit : 90;
        const jmlSoal = config.length ? config[0].jumlah_soal : 100;

        const [soalList] = await db.query(
            "SELECT id FROM questions WHERE paket = ? AND is_active = 1 ORDER BY RAND() LIMIT ?",
            [paket_pilihan, jmlSoal]
        );

        // 5. Inisialisasi Sesi Ujian
        req.session.ujian = {
            paket: paket_pilihan,
            soalIds: soalList.map(s => s.id),
            startTime: Date.now(),
            durasiMs: durasi * 60 * 1000,
            jawaban: {}
        };

        await db.query("UPDATE users SET status_ujian = 'SEDANG_UJIAN', waktu_mulai = NOW() WHERE id = ?", [userId]);
        await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);

        req.session.save(() => res.redirect("/ujian/soal"));

    } catch (err) {
        console.error("ERROR MULAI:", err);
        res.send(`<script>alert('Sistem Error');window.location.href='/users/dashboardPembayaranUjian';</script>`);
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

        const [soalRows] = await db.query(
            "SELECT * FROM questions WHERE id IN (?)",
            [sesi.soalIds]
        );

        const soalMap = {};
        soalRows.forEach((s) => { soalMap[s.id] = s; });
        const soal = sesi.soalIds.map((id) => soalMap[id]).filter(Boolean);

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
        console.error("Error GET /soal:", err);
        res.status(500).send("Terjadi kesalahan.");
    }
});

// ─── POST /simpan-jawaban ───────────────────────────
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

// ─── POST /selesai ─────────────────────────────────
router.post("/selesai", isLogin, async (req, res) => {
    if (!req.session.ujian) return res.json({ ok: false, redirect: "/users/dashboardPembayaranUjian" });
    await hitungDanSimpanSkor(req, res, true);
});

router.get("/selesai-paksa", isLogin, async (req, res) => {
    if (!req.session.ujian) return res.redirect("/users/dashboardPembayaranUjian");
    await hitungDanSimpanSkor(req, res, false);
});

// ─── HELPER: HITUNG SKOR ──────────────────
async function hitungDanSimpanSkor(req, res, jsonResponse = false) {
    const sesi = req.session.ujian;
    const userId = req.session.user.id;

    try {
        const jawabanUserSesi = sesi.jawaban;
        let benar = 0;
        const soalIds = sesi.soalIds;

        // Ambil kunci dengan cara yang aman
        const [soalRows] = await db.query(
            "SELECT id, kunci FROM questions WHERE id IN (?)",
            [soalIds]
        );

        for (const s of soalRows) {
            if (jawabanUserSesi[s.id] === s.kunci) benar++;
        }

        const totalSoal = soalIds.length;
        const skor = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;

        // Update DB User
        await db.query(
            "UPDATE users SET status_ujian = 'SELESAI', skor = ?, tgl_selesai_ujian = NOW() WHERE id = ?",
            [skor, userId]
        );
        // Di dalam fungsi hitungDanSimpanSkor...
await db.query(
    "UPDATE users SET status_ujian = 'IDLE', skor = ?, jml_benar = ?, jml_soal = ? WHERE id = ?",
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

// ─── GET /hasil ─────────────────────────────────────
router.get("/hasil", isLogin, async (req, res) => {
    try {
        // Ambil data skor dan status dari database
        const [rows] = await db.query(
            "SELECT skor, status_ujian FROM users WHERE id = ?",
            [req.session.user.id]
        );

        // Jika user belum selesai ujian tapi coba-coba buka halaman hasil, tendang balik
        if (rows.length === 0) {
            return res.redirect("/users/dashboardPembayaranUjian");
        }

        // --- TAMBAHAN LOGIKA UNTUK MENGHITUNG ULANG JUMLAH BENAR ---
        // Karena di DB kita cuma simpan 'skor' (0-100), kita butuh variabel 'benar'
        // Opsional: Jika lu mau simpan kolom 'jml_benar' di DB itu lebih bagus,
        // tapi kalau mau simpel, kita kirim skor aja atau hitung manual.
        
        res.render("hasilUjian", { 
            skor: rows[0].skor,
            // Jika lu belum simpan jml_benar di DB, kita kasih nilai default atau 0
            // supaya EJS-nya gak error 'is not defined'
            benar: Math.round((rows[0].skor / 100) * 100), // Ini estimasi (asumsi soal 100)
            totalSoal: 100, // Sesuaikan dengan jumlah soal paket lu
            user: req.session.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect("/users/dashboardPembayaranUjian");
    }
});

module.exports = router;