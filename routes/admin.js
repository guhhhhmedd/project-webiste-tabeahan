const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// MIDDLEWARE

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.render("login", {
    error: "Hanya admin yang bisa masuk!",
    rateLimited: false,
    resetTime: null,
  });
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

// MULTER — EXCEL

const storageExcel = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/excel_temp/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadExcel = multer({ storage: storageExcel });

// MULTER — GAMBAR SOAL

const storageSoal = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/soal/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(
      null,
      `soal-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`,
    ),
});

const uploadSoal = multer({
  storage: storageSoal,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/png", "image/jpeg", "image/jpg"].includes(file.mimetype))
      cb(null, true);
    else cb(new Error("Hanya file JPG/PNG yang diperbolehkan!"), false);
  },
});

const cpUploadSoal = uploadSoal.fields([
  { name: "gambar", maxCount: 1 },
  { name: "gambar_a", maxCount: 1 },
  { name: "gambar_b", maxCount: 1 },
  { name: "gambar_c", maxCount: 1 },
  { name: "gambar_d", maxCount: 1 },
  { name: "gambar_e", maxCount: 1 },
  { name: "gambar_pembahasan", maxCount: 1 },
]);

// Helper ambil filename dari req.files
function getFile(files, name) {
  return files && files[name] ? files[name][0].filename : null;
}

// GET /dashboardAdmin

router.get("/dashboardAdmin", isAdmin, async (req, res) => {
  try {
    const [statsSoal] = await db.query(
      "SELECT TRIM(paket) AS paket, COUNT(*) AS total FROM questions GROUP BY TRIM(paket)",
    );

    const [[userStats]] = await db.query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN DATE(create_at) = CURDATE() THEN 1 ELSE 0 END) AS today_users,
        SUM(CASE WHEN status_ujian = 'SEDANG_UJIAN' THEN 1 ELSE 0 END) AS active_exam,
        SUM(CASE WHEN status_ujian = 'SELESAI'      THEN 1 ELSE 0 END) AS finished_exam
      FROM users WHERE role != 'admin'
    `);

    const [chartDataRaw] = await db.query(`
      SELECT DATE_FORMAT(create_at, '%b %Y') AS bulan,
             YEAR(create_at) AS tahun, MONTH(create_at) AS bulan_num, COUNT(*) AS jumlah
      FROM users WHERE role != 'admin'
      GROUP BY YEAR(create_at), MONTH(create_at), DATE_FORMAT(create_at, '%b %Y')
      ORDER BY YEAR(create_at) ASC, MONTH(create_at) ASC
    `);

    let cumulative = 0;
    const chartData = {
      labels: chartDataRaw.map((d) => d.bulan),
      values: chartDataRaw.map((d) => {
        cumulative += parseInt(d.jumlah) || 0;
        return cumulative;
      }),
    };
    if (!chartData.labels.length) {
      chartData.labels = ["Belum ada data"];
      chartData.values = [0];
    }

    const [daftarPaket] = await db.query("SELECT * FROM paket_ujian");

    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.status_ujian, u.skor, u.expired_at, u.is_active,
             p.id AS payment_id, p.paket AS payment_paket, p.nomor_to,
             p.bukti_transfer, p.status AS payment_status, p.token_ujian
      FROM users u
      LEFT JOIN payments p ON p.id = (
        SELECT id FROM payments WHERE user_id = u.id AND UPPER(status) = 'PENDING'
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE u.role != 'admin'
      ORDER BY u.id DESC
    `);

    const [[pendingRow]] = await db.query(`
      SELECT COUNT(DISTINCT p.user_id) AS cnt
      FROM payments p
      INNER JOIN users u ON u.id = p.user_id AND u.role != 'admin'
      WHERE UPPER(p.status) = 'PENDING'
    `);

    res.render("admin/dashboardAdmin", {
      statsSoal,
      daftarPaket,
      users,
      userStats,
      chartData,
      pendingCount: pendingRow.cnt || 0,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("Gagal di dashboardAdmin:", err);
    res.status(500).send("Gagal memuat data admin.");
  }
});

// GET /admin/rankUjian

router.get("/admin/rankUjian", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, u.username, u.email
      FROM riwayat_ujian r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = (
        SELECT id FROM riwayat_ujian r2
        WHERE r2.user_id = r.user_id AND r2.paket = r.paket
        ORDER BY r2.tgl_selesai ASC LIMIT 1
      )
      ORDER BY r.paket ASC, r.skor DESC, r.tgl_selesai ASC
    `);

    const paketGroups = {};
    for (const row of rows) {
      const p = row.paket.trim();
      if (!paketGroups[p]) paketGroups[p] = [];
      paketGroups[p].push(row);
    }
    for (const paket in paketGroups) {
      paketGroups[paket] = paketGroups[paket].map((r, i) => ({
        ...r,
        ranking: i + 1,
        total_skor: r.skor,
      }));
    }

    res.render("admin/rankUjian", {
      paketGroups,
      title: "Ranking Ujian Peserta",
    });
  } catch (err) {
    console.error("Error rankUjian:", err);
    res.status(500).send("Terjadi kesalahan saat memuat ranking.");
  }
});

// GET /admin/daftarPeserta

router.get("/admin/daftarPeserta", isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.email, u.create_at, u.password, u.status_ujian, u.skor
      FROM users u WHERE u.role != 'admin' ORDER BY u.id DESC
    `);

    const [allPayments] = await db.query(`
      SELECT p.id, p.user_id, p.paket, p.nomor_to, p.token_ujian,
             p.tgl_lunas, p.bukti_transfer, UPPER(p.status) AS status, p.created_at, p.expired_at
      FROM payments p JOIN users u ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY p.paket ASC, p.nomor_to ASC, p.created_at DESC
    `);

    const paymentsMap = {};
    for (const p of allPayments) {
      if (!paymentsMap[p.user_id]) paymentsMap[p.user_id] = [];
      paymentsMap[p.user_id].push(p);
    }

    // [FIX] Ambil hasil ujian per user + paket + nomor_to (percobaan terakhir),
    // supaya skor ditampilkan per TO, bukan cuma satu angka global di users.skor
    const [allRiwayat] = await db.query(`
      SELECT r.user_id, r.paket, r.nomor_to, r.skor, r.jml_benar, r.jml_soal,
             r.tgl_selesai, r.percobaan_ke
      FROM riwayat_ujian r
      INNER JOIN (
        SELECT user_id, paket, nomor_to, MAX(percobaan_ke) AS maxAttempt
        FROM riwayat_ujian
        GROUP BY user_id, paket, nomor_to
      ) t ON r.user_id = t.user_id AND r.paket = t.paket
          AND r.nomor_to = t.nomor_to AND r.percobaan_ke = t.maxAttempt
    `);

    const riwayatMap = {};
    for (const r of allRiwayat) {
      if (!riwayatMap[r.user_id]) riwayatMap[r.user_id] = {};
      riwayatMap[r.user_id][`${r.paket}|${r.nomor_to}`] = r;
    }

    res.render("admin/daftarPeserta", {
      users,
      paymentsMap,
      riwayatMap,
      message: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data peserta.");
  }
});

// GET /admin/kelola-soal/:paket

router.get("/admin/kelola-soal/:paket", isAdmin, async (req, res) => {
  const namaPaket = decodeURIComponent(req.params.paket);
  const filterTo = parseInt(req.query.to) || 1;

  try {
    const [soalList] = await db.query(
      `SELECT q.*, m.nama_materi
       FROM questions q LEFT JOIN materi_list m ON q.materi_id = m.id
       WHERE TRIM(q.paket) = ? AND q.nomor_to = ?
       ORDER BY q.nomor_urut ASC`,
      [namaPaket, filterTo],
    );

    const totalAktif = soalList.filter((s) => s.is_active == 1).length;

    const [configRows] = await db.query(
      "SELECT jumlah_soal, durasi_menit, deskripsi, harga, harga_asli FROM paket_ujian WHERE nama_paket = ?",
      [namaPaket],
    );
    const config = configRows[0] || {
      jumlah_soal: 0,
      durasi_menit: 0,
      deskripsi: "",
      harga: 50000,
      harga_asli: null,
    };

    const [availTo] = await db.query(
      "SELECT * FROM paket_to WHERE TRIM(paket) = ? ORDER BY nomor_to ASC",
      [namaPaket],
    );

    const currentTOData = availTo.find((t) => t.nomor_to === filterTo) || {};

    const [materiList] = await db.query(
      "SELECT * FROM materi_list ORDER BY id ASC",
    );

    // Ambil config passing grade paket ini
    const [pgRows] = await db.query(
      "SELECT id, pg_type, pg_kumulatif, pg_min_persen, pg_skor_maks FROM paket_ujian WHERE TRIM(nama_paket) = ? LIMIT 1",
      [namaPaket],
    );
    const paketPg = pgRows[0] || null;

    // Ambil min skor per subtest (hanya jika PER_SUBTEST)
    let pgSubtestList = [];
    if (paketPg && paketPg.pg_type === "PER_SUBTEST") {
      const [subRows] = await db.query(
        "SELECT * FROM paket_pg_subtest WHERE paket_id = ? ORDER BY materi_id ASC",
        [paketPg.id],
      );
      pgSubtestList = subRows;
    }

    res.render("admin/kelolaSoal", {
      paket: namaPaket,
      soalList,
      totalAktif,
      config,
      currentTo: filterTo,
      availTo,
      currentTOData,
      materiList,
      paketPg,
      pgSubtestList,
      message: req.query.msg || req.query.message || null,
      error: req.query.err || req.query.error || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil data soal.");
  }
});

// GET /admin/editSoal/:id
// [FIX #1] Tambah query materiList dan kirim ke view supaya dropdown materi
// tidak lagi hardcoded di file .ejs

router.get("/admin/editSoal/:id", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.redirect("/dashboardAdmin");

    const [materiList] = await db.query(
      "SELECT * FROM materi_list ORDER BY id ASC",
    );

    res.render("admin/editSoal", { s: rows[0], materiList });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat soal.");
  }
});

// GET /admin/anggota

router.get("/admin/anggota", isAdmin, async (req, res) => {
  try {
    const [anggota] = await db.query(
      "SELECT * FROM anggota_offline ORDER BY created_at DESC",
    );
    const [userCount] = await db.query(
      "SELECT COUNT(*) AS total FROM users WHERE is_anggota = 1",
    );
    res.render("admin/anggota", {
      anggota,
      totalAktif: userCount[0].total,
      message: req.query.success ? decodeURIComponent(req.query.success) : null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data anggota.");
  }
});

// POST /admin/verify/:paymentId

router.post("/admin/verify/:paymentId", isAdmin, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const [payments] = await db.query(
      "SELECT user_id FROM payments WHERE id = ?",
      [paymentId],
    );
    if (!payments.length)
      return res.redirect("/admin/daftarPeserta?error=Data+tidak+ada");

    const userId = payments[0].user_id;
    const token = crypto.randomBytes(4).toString("hex").toUpperCase();

    const [userRows] = await db.query(
      "SELECT expired_at FROM users WHERE id = ?",
      [userId],
    );
    let newExpiredDate = new Date();
    const currentExpired = userRows[0]?.expired_at;
    if (currentExpired && new Date(currentExpired) > new Date())
      newExpiredDate = new Date(currentExpired);
    newExpiredDate.setDate(newExpiredDate.getDate() + 7);

    await Promise.all([
      db.query(
        "UPDATE payments SET status = 'LUNAS', token_ujian = ?, tgl_lunas = NOW() WHERE id = ?",
        [token, paymentId],
      ),
      db.query("UPDATE users SET expired_at = ?, is_active = 1 WHERE id = ?", [
        newExpiredDate,
        userId,
      ]),
    ]);

    res.redirect(
      "/admin/daftarPeserta?success=Pembayaran+berhasil+diverifikasi",
    );
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+verifikasi");
  }
});

// POST /admin/reject/:paymentId

router.post("/admin/reject/:paymentId", isAdmin, async (req, res) => {
  try {
    await db.query("UPDATE payments SET status = 'DITOLAK' WHERE id = ?", [
      req.params.paymentId,
    ]);
    res.redirect("/admin/daftarPeserta?success=Pembayaran+ditolak.");
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+menolak.");
  }
});

// POST /admin/tambah-soal

router.post(
  "/admin/tambah-soal",
  isAdmin,
  (req, res, next) => {
    cpUploadSoal(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
        return res.redirect(
          "/dashboardAdmin?error=Ukuran+gambar+maksimal+2MB.",
        );
      if (err instanceof multer.MulterError)
        return res.redirect("/dashboardAdmin?error=Kesalahan+upload+gambar.");
      if (err)
        return res.redirect(
          "/dashboardAdmin?error=" + encodeURIComponent(err.message),
        );
      next();
    });
  },
  async (req, res) => {
    const {
      paket,
      nomor_to,
      materi_id,
      nomor_urut,
      soal,
      a,
      b,
      c,
      d,
      e,
      kunci,
      pembahasan,
      bobot_a,
      bobot_b,
      bobot_c,
      bobot_d,
      bobot_e,
    } = req.body;
    try {
      // [FIX] Cek duplikat manual (bukan lewat ER_DUP_ENTRY karena tidak ada
      // UNIQUE constraint di kolom nomor_urut pada tabel questions)
      const [dup] = await db.query(
        "SELECT id FROM questions WHERE paket = ? AND nomor_to = ? AND nomor_urut = ?",
        [paket, nomor_to, nomor_urut],
      );
      if (dup.length) {
        return res.redirect(
          `/dashboardAdmin?error=Gagal!+Nomor+urut+${nomor_urut}+sudah+ada.`,
        );
      }

      const tipe = [3, 10, 11, 12].includes(parseInt(materi_id))
        ? "BOBOT_OPSI"
        : "BENAR_SALAH";
      await db.query(
        `INSERT INTO questions
         (paket, nomor_to, materi_id, nomor_urut, soal,
          opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan,
          tipe_penilaian, bobot_a, bobot_b, bobot_c, bobot_d, bobot_e,
          gambar, gambar_a, gambar_b, gambar_c, gambar_d, gambar_e, gambar_pembahasan)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          paket,
          nomor_to,
          materi_id,
          nomor_urut,
          soal,
          a,
          b,
          c,
          d,
          e,
          kunci || "",
          pembahasan || "",
          tipe,
          bobot_a || 0,
          bobot_b || 0,
          bobot_c || 0,
          bobot_d || 0,
          bobot_e || 0,
          getFile(req.files, "gambar"),
          getFile(req.files, "gambar_a"),
          getFile(req.files, "gambar_b"),
          getFile(req.files, "gambar_c"),
          getFile(req.files, "gambar_d"),
          getFile(req.files, "gambar_e"),
          getFile(req.files, "gambar_pembahasan"),
        ],
      );
      res.redirect("/dashboardAdmin?message=Soal+berhasil+ditambah");
    } catch (err) {
      console.error(err);
      res.redirect("/dashboardAdmin?error=Gagal+tambah+soal.");
    }
  },
);

// POST /admin/updateSoal
// [FIX #2] Cek duplikat nomor_urut sebelum UPDATE (exclude id sendiri)
// [FIX #3] catch block tidak lagi res.status(500).send(...) supaya tidak blank page,
// sekarang redirect balik ke halaman kelola-soal dengan pesan error

router.post(
  "/admin/updateSoal",
  isAdmin,
  (req, res, next) => {
    cpUploadSoal(req, res, (err) => {
      const to = req.body.nomor_to || 1;
      const paket = req.body.paket || "";
      const back = `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${to}`;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
        return res.redirect(back + "&error=Ukuran+gambar+maksimal+2MB.");
      if (err instanceof multer.MulterError)
        return res.redirect(back + "&error=Kesalahan+upload+gambar.");
      if (err)
        return res.redirect(back + "&error=" + encodeURIComponent(err.message));
      next();
    });
  },
  async (req, res) => {
    const {
      id,
      paket,
      nomor_to,
      materi_id,
      nomor_urut,
      soal,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d,
      opsi_e,
      kunci,
      pembahasan,
      bobot_a,
      bobot_b,
      bobot_c,
      bobot_d,
      bobot_e,
    } = req.body;

    const back = `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nomor_to}`;

    try {
      // [FIX #2] Cek duplikat nomor_urut di paket+TO yang sama, kecuali soal ini sendiri
      const [dup] = await db.query(
        "SELECT id FROM questions WHERE paket = ? AND nomor_to = ? AND nomor_urut = ? AND id <> ?",
        [paket, nomor_to, nomor_urut, id],
      );
      if (dup.length) {
        return res.redirect(
          back + `&error=Nomor+urut+${nomor_urut}+sudah+dipakai+soal+lain`,
        );
      }

      const tipe = [3, 10, 11, 12].includes(parseInt(materi_id))
        ? "BOBOT_OPSI"
        : "BENAR_SALAH";

      let q = `UPDATE questions
             SET paket=?, nomor_to=?, materi_id=?, nomor_urut=?, soal=?,
                 opsi_a=?, opsi_b=?, opsi_c=?, opsi_d=?, opsi_e=?,
                 kunci=?, pembahasan=?, tipe_penilaian=?,
                 bobot_a=?, bobot_b=?, bobot_c=?, bobot_d=?, bobot_e=?`;
      const p = [
        paket,
        nomor_to,
        materi_id,
        nomor_urut,
        soal,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        opsi_e,
        kunci || "",
        pembahasan || "",
        tipe,
        bobot_a || 0,
        bobot_b || 0,
        bobot_c || 0,
        bobot_d || 0,
        bobot_e || 0,
      ];

      for (const f of [
        "gambar",
        "gambar_a",
        "gambar_b",
        "gambar_c",
        "gambar_d",
        "gambar_e",
        "gambar_pembahasan",
      ]) {
        const fn = getFile(req.files, f);
        if (fn) {
          q += `, ${f}=?`;
          p.push(fn);
        }
      }

      q += " WHERE id=?";
      p.push(id);

      await db.query(q, p);
      res.redirect(back + "&message=Soal+berhasil+diupdate");
    } catch (err) {
      console.error(err);
      // [FIX #3] Jangan blank page — redirect balik dengan pesan error
      res.redirect(back + "&error=Gagal+update+soal");
    }
  },
);

// POST /admin/upload-soal (import Excel)

router.post(
  "/admin/upload-soal",
  isAdmin,
  uploadExcel.single("fileExcel"),
  async (req, res) => {
    if (!req.file) return res.status(400).send("File tidak ditemukan.");
    try {
      const rows = XLSX.utils.sheet_to_json(
        XLSX.readFile(req.file.path).Sheets[
          XLSX.readFile(req.file.path).SheetNames[0]
        ],
        { range: 1, defval: null },
      );

      let inserted = 0,
        skipped = 0;
      const duplicateErrors = [];

      for (const row of rows) {
        const paket = (row.paket || "").trim();
        const nomorTo = parseInt(row.nomor_to);
        if (!nomorTo || isNaN(nomorTo)) {
          skipped++;
          continue;
        }

        // [FIX] Cek duplikat manual karena tidak ada UNIQUE constraint di DB
        const [dup] = await db.query(
          "SELECT id FROM questions WHERE paket = ? AND nomor_to = ? AND nomor_urut = ?",
          [paket, nomorTo, row.nomor_urut],
        );
        if (dup.length) {
          duplicateErrors.push(`No.${row.nomor_urut}`);
          skipped++;
          continue;
        }

        await db.query(
          `INSERT INTO questions
           (paket, nomor_to, materi_id, nomor_urut, soal,
            opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan,
            tipe_penilaian, bobot_a, bobot_b, bobot_c, bobot_d, bobot_e)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            paket,
            nomorTo,
            row.materi_id,
            row.nomor_urut,
            row.soal,
            row.a,
            row.b,
            row.c,
            row.d,
            row.e,
            (row.kunci || "").toString().trim().toUpperCase(),
            (row.pembahasan || "").toString().trim(),
            [3, 10, 11, 12].includes(parseInt(row.materi_id))
              ? "BOBOT_OPSI"
              : "BENAR_SALAH",
            Number(row.bobot_a) || 0,
            Number(row.bobot_b) || 0,
            Number(row.bobot_c) || 0,
            Number(row.bobot_d) || 0,
            Number(row.bobot_e) || 0,
          ],
        );
        inserted++;
      }

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      let msg = `Import selesai: ${inserted} soal ditambah.`;
      if (duplicateErrors.length)
        msg += ` ${duplicateErrors.length} duplikat dilewati.`;
      res.redirect(`/dashboardAdmin?message=${encodeURIComponent(msg)}`);
    } catch (err) {
      console.error("ERROR IMPORT EXCEL:", err);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      res.redirect(
        "/dashboardAdmin?error=Gagal+proses+Excel.+Cek+format+kolom+dan+materi_id.",
      );
    }
  },
);

// POST /admin/tambah-soal-manual
// [FIX #4] Cek duplikat nomor_urut sebelum INSERT

router.post(
  "/admin/tambah-soal-manual",
  isAdmin,
  (req, res, next) => {
    cpUploadSoal(req, res, (err) => {
      const to = req.body.nomor_to || 1;
      const paket = req.body.paket || "";
      const back = `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${to}`;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
        return res.redirect(back + "&error=Ukuran+gambar+maksimal+2MB.");
      if (err instanceof multer.MulterError)
        return res.redirect(back + "&error=Kesalahan+upload+gambar.");
      if (err)
        return res.redirect(back + "&error=" + encodeURIComponent(err.message));
      next();
    });
  },
  async (req, res) => {
    const {
      paket,
      nomor_to,
      materi_id,
      nomor_urut,
      soal,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d,
      opsi_e,
      kunci,
      pembahasan,
      bobot_a,
      bobot_b,
      bobot_c,
      bobot_d,
      bobot_e,
    } = req.body;

    const back = `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nomor_to}`;

    try {
      // [FIX #4] Cek duplikat nomor_urut di paket+TO yang sama sebelum insert
      const [dup] = await db.query(
        "SELECT id FROM questions WHERE paket = ? AND nomor_to = ? AND nomor_urut = ?",
        [paket, nomor_to, nomor_urut],
      );
      if (dup.length) {
        return res.redirect(
          back + `&error=Nomor+urut+${nomor_urut}+sudah+dipakai+soal+lain`,
        );
      }

      const m_id = parseInt(materi_id) || 1;
      await db.query(
        `INSERT INTO questions
         (paket, nomor_to, materi_id, nomor_urut, soal,
          opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, pembahasan,
          tipe_penilaian, bobot_a, bobot_b, bobot_c, bobot_d, bobot_e,
          gambar, gambar_a, gambar_b, gambar_c, gambar_d, gambar_e, gambar_pembahasan)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          paket,
          nomor_to,
          m_id,
          nomor_urut,
          soal,
          opsi_a,
          opsi_b,
          opsi_c,
          opsi_d,
          opsi_e,
          (kunci || "A").toString().trim().toUpperCase(),
          (pembahasan || "").toString().trim(),
          [3, 10, 11, 12].includes(m_id) ? "BOBOT_OPSI" : "BENAR_SALAH",
          Number(bobot_a) || 0,
          Number(bobot_b) || 0,
          Number(bobot_c) || 0,
          Number(bobot_d) || 0,
          Number(bobot_e) || 0,
          getFile(req.files, "gambar"),
          getFile(req.files, "gambar_a"),
          getFile(req.files, "gambar_b"),
          getFile(req.files, "gambar_c"),
          getFile(req.files, "gambar_d"),
          getFile(req.files, "gambar_e"),
          getFile(req.files, "gambar_pembahasan"),
        ],
      );
      res.redirect(back + "&message=Soal+berhasil+ditambahkan");
    } catch (err) {
      console.error(err);
      res.redirect(back + "&error=Gagal+menambahkan+soal");
    }
  },
);

// POST /admin/toggle-soal

router.post("/admin/toggle-soal", isAdmin, async (req, res) => {
  try {
    await db.query("UPDATE questions SET is_active = ? WHERE id = ?", [
      req.body.is_active,
      req.body.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

// POST /admin/toggle-all-soal

router.post("/admin/toggle-all-soal", isAdmin, async (req, res) => {
  const { paket, is_active, current_to } = req.body;
  try {
    await db.query(
      "UPDATE questions SET is_active = ? WHERE paket = ? AND nomor_to = ?",
      [is_active, paket, current_to],
    );
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${current_to}&message=Status+TO+${current_to}+berhasil+diubah`,
    );
  } catch (err) {
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${current_to}&error=Gagal+update`,
    );
  }
});

// POST /admin/update-config-paket

router.post("/admin/update-config-paket", isAdmin, async (req, res) => {
  const { paket, jumlah_soal, durasi_menit, deskripsi, harga, harga_asli } =
    req.body;
  try {
    await db.query(
      `UPDATE paket_ujian
       SET jumlah_soal=?, durasi_menit=?, deskripsi=?, harga=?, harga_asli=?
       WHERE nama_paket=?`,
      [
        parseInt(jumlah_soal),
        parseInt(durasi_menit),
        deskripsi || null,
        parseInt(harga) || 50000,
        harga_asli ? parseInt(harga_asli) : null,
        paket,
      ],
    );
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Konfigurasi+berhasil+diupdate`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?error=Gagal+update`,
    );
  }
});

// POST /admin/delete-soal

router.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Soal+berhasil+dihapus`,
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menghapus soal.");
  }
});

// POST /admin/update-durasi

router.post("/admin/update-durasi", isAdmin, async (req, res) => {
  try {
    await db.query("UPDATE paket_ujian SET durasi_menit = ? WHERE id = ?", [
      req.body.durasi,
      req.body.id,
    ]);
    res.redirect("/dashboardAdmin?message=Durasi+berhasil+diperbarui");
  } catch (err) {
    res.redirect("/dashboardAdmin?error=Gagal+update+durasi");
  }
});

// POST /deleteAccountFromAdmin

router.post("/deleteAccountFromAdmin", isAdmin, async (req, res) => {
  const { id } = req.body;
  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [id],
    );
    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const fp = path.join(
          process.cwd(),
          "public",
          "uploads",
          "bukti",
          p.bukti_transfer,
        );
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    });
    await Promise.all([
      db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [id]),
      db.query("DELETE FROM riwayat_ujian WHERE user_id = ?", [id]),
      db.query("DELETE FROM payments WHERE user_id = ?", [id]),
      db.query("DELETE FROM users WHERE id = ?", [id]),
    ]);
    res.redirect(
      "/dashboardAdmin?message=Akun+dan+seluruh+data+terkait+berhasil+dihapus",
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal hapus data.");
  }
});

// POST /admin/reset-ujian-user

router.post("/admin/reset-ujian-user", isAdmin, async (req, res) => {
  const { userIdTarget, paket_pilihan, nomor_to } = req.body;
  try {
    await Promise.all([
      db.query(
        "UPDATE payments SET status = 'LUNAS' WHERE user_id = ? AND paket = ? AND nomor_to = ?",
        [userIdTarget, paket_pilihan, nomor_to],
      ),
      db.query(
        `DELETE FROM jawaban_peserta WHERE user_id = ?
                AND question_id IN (SELECT id FROM questions WHERE paket = ? AND nomor_to = ?)`,
        [userIdTarget, paket_pilihan, nomor_to],
      ),
      db.query("UPDATE users SET status_ujian = 'IDLE' WHERE id = ?", [
        userIdTarget,
      ]),
    ]);
    res.redirect(
      "/admin/daftarPeserta?success=Ujian+berhasil+direset%2C+user+bisa+ujian+kembali",
    );
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+reset+ujian");
  }
});

// POST /admin/delete-payment

router.post("/admin/delete-payment", isAdmin, async (req, res) => {
  const { paymentId } = req.body;
  try {
    const [rows] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE id = ?",
      [paymentId],
    );
    if (rows.length > 0 && rows[0].bukti_transfer) {
      const fp = path.join(
        process.cwd(),
        "public",
        "uploads",
        "bukti",
        rows[0].bukti_transfer,
      );
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query("DELETE FROM payments WHERE id = ?", [paymentId]);
    res.redirect(
      "/admin/daftarPeserta?success=Riwayat+pembayaran+berhasil+dihapus",
    );
  } catch (err) {
    console.error(err);
    res.redirect("/admin/daftarPeserta?error=Gagal+hapus+riwayat");
  }
});

// POST /admin/anggota/tambah

router.post("/admin/anggota/tambah", isAdmin, async (req, res) => {
  const { email, nama, catatan } = req.body;
  if (!email || !email.includes("@"))
    return res.redirect(
      "/admin/anggota?error=" + encodeURIComponent("Email tidak valid."),
    );
  try {
    await db.query(
      "INSERT INTO anggota_offline (email, nama, catatan) VALUES (?,?,?)",
      [email.toLowerCase().trim(), nama || null, catatan || null],
    );
    await db.query(
      "UPDATE users SET is_anggota = 1 WHERE LOWER(email) = LOWER(?)",
      [email.trim()],
    );
    res.redirect(
      "/admin/anggota?success=" +
        encodeURIComponent(`Email ${email} berhasil ditambahkan.`),
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.redirect(
        "/admin/anggota?error=" +
          encodeURIComponent("Email sudah terdaftar di whitelist."),
      );
    console.error(err);
    res.redirect(
      "/admin/anggota?error=" + encodeURIComponent("Gagal menambahkan email."),
    );
  }
});

// POST /admin/reset-password

router.post("/admin/reset-password", isAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.redirect(
      "/admin/daftarPeserta?error=" +
        encodeURIComponent("Password minimal 6 karakter."),
    );
  try {
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      await bcrypt.hash(newPassword, SALT_ROUNDS),
      userId,
    ]);
    res.redirect(
      "/admin/daftarPeserta?success=" +
        encodeURIComponent("Password berhasil direset."),
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      "/admin/daftarPeserta?error=" +
        encodeURIComponent("Gagal reset password."),
    );
  }
});

// POST /admin/anggota/hapus

router.post("/admin/anggota/hapus", isAdmin, async (req, res) => {
  const { id, email } = req.body;
  try {
    await db.query("DELETE FROM anggota_offline WHERE id = ?", [id]);
    await db.query(
      "UPDATE users SET is_anggota = 0 WHERE LOWER(email) = LOWER(?)",
      [email],
    );
    res.redirect(
      "/admin/anggota?success=" +
        encodeURIComponent("Email berhasil dihapus dari whitelist."),
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      "/admin/anggota?error=" + encodeURIComponent("Gagal menghapus email."),
    );
  }
});

// POST /admin/tryout/tambah

router.post("/admin/tryout/tambah", isAdmin, async (req, res) => {
  const { paket } = req.body;
  try {
    const [rows] = await db.query(
      "SELECT MAX(nomor_to) AS maxTo FROM paket_to WHERE TRIM(paket) = ?",
      [paket],
    );
    const nextTo = (rows[0].maxTo || 0) + 1;
    await db.query("INSERT INTO paket_to (paket, nomor_to) VALUES (?,?)", [
      paket,
      nextTo,
    ]);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nextTo}&message=${encodeURIComponent("TryOut baru berhasil dibuat")}`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?error=${encodeURIComponent("Gagal tambah TryOut")}`,
    );
  }
});

// POST /admin/tryout/delete

router.post("/admin/tryout/delete", isAdmin, async (req, res) => {
  const { paket, nomor_to } = req.body;
  const deletedTo = parseInt(nomor_to);
  try {
    await db.query(
      "DELETE FROM questions WHERE TRIM(paket) = ? AND nomor_to = ?",
      [paket, deletedTo],
    );
    await db.query(
      "DELETE FROM paket_to WHERE TRIM(paket) = ? AND nomor_to = ?",
      [paket, deletedTo],
    );

    const [toList] = await db.query(
      "SELECT nomor_to FROM paket_to WHERE TRIM(paket) = ? AND nomor_to > ? ORDER BY nomor_to ASC",
      [paket, deletedTo],
    );
    for (const row of toList) {
      const oldTo = row.nomor_to,
        newTo = oldTo - 1;
      await db.query(
        "UPDATE questions SET nomor_to=? WHERE TRIM(paket)=? AND nomor_to=?",
        [newTo, paket, oldTo],
      );
      await db.query(
        "UPDATE paket_to  SET nomor_to=? WHERE TRIM(paket)=? AND nomor_to=?",
        [newTo, paket, oldTo],
      );
      await db.query(
        "UPDATE payments  SET nomor_to=? WHERE TRIM(paket)=? AND nomor_to=?",
        [newTo, paket, oldTo],
      );
    }
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=${encodeURIComponent("TryOut berhasil dihapus")}`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?error=${encodeURIComponent("Gagal hapus TryOut")}`,
    );
  }
});

// POST /admin/tryout/publish

router.post("/admin/tryout/publish", isAdmin, async (req, res) => {
  const { paket, nomor_to, is_published } = req.body;
  try {
    await db.query(
      "UPDATE paket_to SET is_published=? WHERE TRIM(paket)=? AND nomor_to=?",
      [is_published, paket, nomor_to],
    );
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nomor_to}&message=${encodeURIComponent("Status penjualan TO berhasil diupdate")}`,
    );
  } catch (err) {
    console.error(err);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?to=${nomor_to}&error=${encodeURIComponent("Gagal update penjualan")}`,
    );
  }
});

// POST /admin/passing-grade/update
router.post("/admin/passing-grade/update", isAdmin, async (req, res) => {
  const {
    paket_id,
    pg_type,
    pg_kumulatif,
    pg_min_persen,
    pg_skor_maks,
    redirect_to,
  } = req.body;
  const back = redirect_to || "/dashboardAdmin";
  try {
    await db.query(
      `UPDATE paket_ujian
       SET pg_type=?, pg_kumulatif=?, pg_min_persen=?, pg_skor_maks=?
       WHERE id=?`,
      [
        pg_type,
        pg_kumulatif ? parseInt(pg_kumulatif) : null,
        pg_min_persen ? parseFloat(pg_min_persen) : null,
        pg_skor_maks ? parseInt(pg_skor_maks) : null,
        parseInt(paket_id),
      ],
    );
    const sep = back.includes("?") ? "&" : "?";
    res.redirect(
      back +
        sep +
        "message=" +
        encodeURIComponent("Passing grade berhasil disimpan."),
    );
  } catch (err) {
    console.error(err);
    const sep = back.includes("?") ? "&" : "?";
    res.redirect(
      back +
        sep +
        "error=" +
        encodeURIComponent("Gagal menyimpan passing grade."),
    );
  }
});

// POST /admin/passing-grade/subtest/save
router.post("/admin/passing-grade/subtest/save", isAdmin, async (req, res) => {
  const { paket_id, materi_id, nama_materi, min_skor, redirect_to } = req.body;
  const back = redirect_to || "/dashboardAdmin";
  try {
    await db.query(
      `INSERT INTO paket_pg_subtest (paket_id, materi_id, nama_materi, min_skor)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE nama_materi=VALUES(nama_materi), min_skor=VALUES(min_skor)`,
      [
        parseInt(paket_id),
        parseInt(materi_id),
        nama_materi || "",
        parseInt(min_skor) || 0,
      ],
    );
    const sep = back.includes("?") ? "&" : "?";
    res.redirect(
      back +
        sep +
        "message=" +
        encodeURIComponent("Min skor subtest berhasil disimpan."),
    );
  } catch (err) {
    console.error(err);
    const sep = back.includes("?") ? "&" : "?";
    res.redirect(
      back + sep + "error=" + encodeURIComponent("Gagal menyimpan subtest."),
    );
  }
});

// POST /admin/passing-grade/subtest/delete
router.post(
  "/admin/passing-grade/subtest/delete",
  isAdmin,
  async (req, res) => {
    const { id, redirect_to } = req.body;
    const back = redirect_to || "/dashboardAdmin";
    try {
      await db.query("DELETE FROM paket_pg_subtest WHERE id=?", [parseInt(id)]);
      const sep = back.includes("?") ? "&" : "?";
      res.redirect(
        back +
          sep +
          "message=" +
          encodeURIComponent("Subtest berhasil dihapus."),
      );
    } catch (err) {
      console.error(err);
      const sep = back.includes("?") ? "&" : "?";
      res.redirect(
        back + sep + "error=" + encodeURIComponent("Gagal menghapus subtest."),
      );
    }
  },
);

module.exports = router;