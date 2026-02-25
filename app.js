require("dotenv").config();
const helmet = require("helmet");
const compression = require("compression");
const session = require("express-session");
const express = require("express");
const app = express();
const port = 3000;
const db = require("./config/db"); // db pakai versi PROMISE
const multer = require("multer");
const path = require("path");
const ujianRouter = require("./routes/ujian");
const XLSX = require("xlsx");
const fs = require("fs"); // Bawaan Node.js untuk urusan file
const rateLimit = require("express-rate-limit");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://img.youtube.com"],
        fontSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
      },
    },
  }),
);
app.use(compression());
// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(
  session({
    secret: "tabeahan-cendekia-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// Middleware biar kalo reload gak bisa keluar selain logout
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0",
  );
  next();
});

app.set("view engine", "ejs");
app.set("views", "views");
app.use("/ujian", ujianRouter); // ROUTER UJIAN

// batas tes untuk setiap login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, 
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000); // waktu reset dalam detik (unix timestamp)
    res.status(429).render("login", {
      error: null,
      rateLimited: true,
      resetTime: retryAfter,
    });
  },
});

// batas untuk  maksimal 5 registrasi per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Terlalu banyak registrasi, coba lagi 1 jam lagi.",
});

// KONFIGURASI MULTER
const storageBukti = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/bukti/"),
  filename: (req, file, cb) => {
    const userId = req.session.user ? req.session.user.id : "anon";
    cb(null, `bukti-${userId}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// upload bukti pembayaran
const uploadBukti = multer({
  storage: storageBukti,
  limits: { fileSize: 2 * 1024 * 1024 }, // maksimal 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG/PNG yang diizinkan!"));
    }
  },
});

// Konfigurasi Multer untuk Excel
const storageExcel = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/excel_temp/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadExcel = multer({ storage: storageExcel });

// MIDDLEWARE PROTEKSI
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.render("login", { error: "Hanya admin yang bisa masuk!" });
}

app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/terms", (req, res) => {
  res.render("terms");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});

app.get("/register", (req, res) => {
  if (req.session.users) return res.redirect("/register");
  res.render("register", { err: null });
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

app.get("/dashboard", isLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    if (user.status_ujian === "SEDANG_UJIAN") {
      return res.send(`<script>alert('Ujian sedang berlangsung!');window.location.href='/ujian/soal';</script>`);
    }

    const [rankingRows] = await db.query(`
      SELECT username, skor FROM users 
      WHERE status_ujian = 'SELESAI' 
      ORDER BY skor DESC, id ASC
    `);

    // Tambah query paket
    const [paketList] = await db.query(
      "SELECT * FROM paket_ujian WHERE is_active = 1"
    );

    const myRank = rankingRows.findIndex((r) => r.username === user.username) + 1;

    res.render("users/dashboard", {
      user,
      rankings: rankingRows.slice(0, 5),
      myRank: myRank > 0 ? myRank : "-",
      uploadError: req.query.uploadError || null,
      paketList, // ← tambah ini
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error");
  }
});

// edit soal
app.get("/admin/kelola-soal/:paket", isAdmin, async (req, res) => {
  const namaPaket = req.params.paket;
  try {
    const [soalList] = await db.query(
      "SELECT * FROM questions WHERE TRIM(paket) = ? ORDER BY id DESC",
      [namaPaket],
    );

    res.render("admin/kelolaSoal", {
      paket: namaPaket,
      soalList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil data soal untuk paket ini.");
  }
});

//
app.get("/admin/editSoal/:id", isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) return res.redirect("/dashboardAdmin");

    res.render("admin/editSoal", { s: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error Database: " + err.message);
  }
});

//  Update soal
app.post("/admin/updateSoal", isAdmin, async (req, res) => {
  const {
    id,
    paket,
    materi,
    soal,
    opsi_a,
    opsi_b,
    opsi_c,
    opsi_d,
    opsi_e,
    kunci,
  } = req.body;

  try {
    const sql = `
            UPDATE questions 
            SET paket = ?, materi = ?, soal = ?, 
                opsi_a = ?, opsi_b = ?, opsi_c = ?, opsi_d = ?, opsi_e = ?, 
                kunci = ? 
            WHERE id = ?
        `;

    await db.query(sql, [
      paket,
      materi,
      soal,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d,
      opsi_e,
      kunci,
      id,
    ]);

    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal Update: " + err.message);
  }
});

// PROSES HAPUS SOAL
app.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(`/admin/kelola-soal/${encodeURIComponent(paket)}`);
  } catch (err) {
    res.status(500).send("Gagal menghapus soal");
  }
});

app.get("/dashboardAdmin", isAdmin, async (req, res) => {
  try {
    const [statsSoal] = await db.query(`
            SELECT TRIM(paket) AS paket, COUNT(*) AS total 
            FROM questions 
            GROUP BY TRIM(paket)
        `);

    const [daftarPaket] = await db.query("SELECT * FROM paket_ujian");

    const [users] = await db.query(`
            SELECT 
                u.*, 
                p.bukti_transfer 
            FROM users u
            LEFT JOIN (
                SELECT user_id, bukti_transfer 
                FROM payments 
                ORDER BY id DESC 
                LIMIT 1
            ) p ON u.id = p.user_id
            WHERE u.role != 'admin'
            ORDER BY u.id DESC
        `);

    res.render("admin/dashboardAdmin", {
      statsSoal,
      daftarPaket,
      users,
    });
  } catch (err) {
    console.error("Gagal di dashboardAdmin:", err);
    res.status(500).send("Gagal memuat data admin");
  }
});

app.post("/admin/update-durasi", isAdmin, async (req, res) => {
  const { id, durasi } = req.body;
  try {
    await db.query("UPDATE paket_ujian SET durasi_menit = ? WHERE id = ?", [
      durasi,
      id,
    ]);
    res.redirect("/dashboardAdmin?message=Durasi berhasil diperbarui");
  } catch (err) {
    res.redirect("/dashboardAdmin?error=Gagal update durasi");
  }
});

app.get("/admin/daftarPeserta", isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
            SELECT 
                u.*, 
                p.bukti_transfer 
            FROM users u
            LEFT JOIN (
                SELECT user_id, bukti_transfer 
                FROM payments 
                ORDER BY id DESC 
                LIMIT 1
            ) p ON u.id = p.user_id
            WHERE u.role != 'admin'
            ORDER BY u.id DESC
        `);

    res.render("admin/daftarPeserta", { users });
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal memuat data peserta");
  }
});

// --- IMPORT EXCEL ---
app.post(
  "/admin/upload-soal",
  isAdmin,
  uploadExcel.single("fileExcel"),
  async (req, res) => {
    if (!req.file) return res.status(400).send("File kaga ada, Bre!");

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      for (const row of rows) {
        await db.query(
          `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_nilai) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.paket,
            row.materi,
            row.soal,
            row.a,
            row.b,
            row.c,
            row.d,
            row.e,
            row.kunci,
            row.bobot || 5, // Jika di excel ga ada kolom 'bobot', kasih nilai 5
          ],
        );
      }

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.redirect("/dashboardAdmin?message=Import Berhasil!");
      console.log("masuk breay");
    } catch (err) {
      console.error("ERROR IMPORT EXCEL:", err);
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      res
        .status(500)
        .send(
          "Gagal proses Excel. Pastikan nama kolom di Excel: soal, a, b, c, d, e, kunci, paket, materi",
        );
    }
  },
);

// --- TAMBAH MANUAL ---
app.post("/admin/tambah-soal", isAdmin, async (req, res) => {
  const { paket, materi, soal, a, b, c, d, e, kunci } = req.body;
  try {
    await db.query(
      `INSERT INTO questions (paket, materi, soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_nilai) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5)`, // set bobot default 5
      [paket, materi, soal, a, b, c, d, e, kunci],
    );
    res.redirect("/dashboardAdmin?message=Soal berhasil ditambah");
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send(
        "Gagal tambah soal manual. Cek apakah kolom opsi_a dkk sudah benar di DB.",
      );
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0 || password !== rows[0].password) {
      return res.render("login", {
        error: "Username atau Password salah",
        rateLimited: false,
        resetTime: null,
      });
    }
    const user = rows[0];
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role.toLowerCase(),
    };
    res.redirect(user.role === "admin" ? "/dashboardAdmin" : "/dashboard");
  } catch (err) {
    console.error("ERROR LOGIN:", err);
    res.render("login", {
      error: "Terjadi kesalahan server coba lagi ",
      rateLimited: false,
      resetTime: null,
    });
  }
});

app.post("/register", registerLimiter, async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.render("register", { err: "Semua form wajib diisi!" });
  }

  if (username.length < 3 || username.length > 20) {
    return res.render("register", { err: "Username harus 3-20 karakter!" });
  }

  if (password.length < 6) {
    return res.render("register", { err: "Password minimal 6 karakter!" });
  }

  // Validasi format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.render("register", { err: "Format email tidak valid!" });
  }

  try {
    const sql =
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'users')";
    await db.query(sql, [username, password, email]);
    res.redirect("/login");
  } catch (err) {
    console.error("ERROR REGISTER:", err);
    let pesanError = "Gagal registrasi.";
    if (err.code === "ER_DUP_ENTRY")
      pesanError = "Username atau Email sudah terdaftar!";
    res.render("register", { err: pesanError });
  }
});

app.post(
  "/users/upload-bukti",
  isLogin,
  (req, res, next) => {
    uploadBukti.single("bukti")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          return res.redirect(
            "/dashboard?uploadError=File terlalu besar! Maksimal 2MB.",
          );
        return res.redirect("/dashboard?uploadError=Error upload file.");
      } else if (err) {
        return res.redirect(`/dashboard?uploadError=${err.message}`);
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file)
      return res.redirect(
        "/dashboard?uploadError=Mohon pilih file terlebih dahulu.",
      );
    try {
      const userId = req.session.user.id;
      await db.query(
        "INSERT INTO payments (user_id, bukti_transfer, status) VALUES (?, ?, 'PENDING')",
        [userId, req.file.filename],
      );
      await db.query("UPDATE users SET status = 'PENDING' WHERE id = ?", [
        userId,
      ]);
      res.redirect("/dashboard");
    } catch (err) {
      console.error(err);
      res.redirect("/dashboard?uploadError=Gagal upload, silakan coba lagi.");
    }
  },
);

// tolakPembayaran
app.get("/admin/reject/:id", isAdmin, async (req, res) => {
  const targetId = req.params.id;
  try {
    await db.query("UPDATE users SET status = 'DITOLAK' WHERE id = ?", [
      targetId,
    ]);
    await db.query("UPDATE payments SET status = 'DITOLAK' WHERE user_id = ?", [
      targetId,
    ]);
    res.redirect("/admin/daftarPeserta/");
  } catch (err) {
    res.status(500).send("Gagal menolak verifikasi");
  }
});

app.get("/admin/verify/:id", isLogin, isAdmin, async (req, res) => {
  const targetId = req.params.id; // Ini ID orang yang mau diverifikasi

  try {
    const tokenBaru = Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.query(
      "UPDATE users SET status = 'LUNAS', token_ujian = ? WHERE id = ?",
      [tokenBaru, targetId],
    );

    const [result] = await db.query(
      "UPDATE payments SET status = 'LUNAS' WHERE user_id = ?",
      [targetId],
    );

    console.log(
      `Update payment untuk User ${targetId} berhasil. Baris terpengaruh: ${result.affectedRows}`,
    );

    res.redirect("/admin/daftarPeserta/");
  } catch (err) {
    console.error("ERROR VERIFIKASI:", err);
    res.status(500).send(`
            <h3>Gagal Verifikasi Le!</h3>
            <p>Pesan Error: ${err.message}</p>
            <a href="/dashboardAdmin">Kembali ke Dashboard</a>
        `);
  }
});

// delete account dari dashboard user
app.post("/deleteAccount", isLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [userId],
    );

    //Loop & hapus semua file fisiknya dari folder
    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(
          __dirname,
          "public/uploads/bukti/",
          p.bukti_transfer,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM users WHERE id = ?", [userId]);

    req.session.destroy((err) => {
      if (err) {
        console.error("Gagal hancurkan session:", err);
        return res.redirect("/dashboard");
      }
      res.clearCookie("connect.sid");
      res.redirect("/register?message=Akun Anda berhasil dihapus permanen");
    });
  } catch (error) {
    console.error("ERROR HAPUS AKUN SENDIRI:", error);
    res.status(500).send("Gagal menghapus akun, hubungi admin.");
  }
});

// delete account dari halaman admin
// pelajaran penting kalo mau hapus data baiknya mulai hapus dari bawah keatas jangan dari atas kebawah
app.post("/deleteAccountFromAdmin", isAdmin, async (req, res) => {
  const { id } = req.body;

  try {
    const [payments] = await db.query(
      "SELECT bukti_transfer FROM payments WHERE user_id = ?",
      [id],
    );

    // Pakai forEach buat hapus filenya satu-persatu dari folder
    payments.forEach((p) => {
      if (p.bukti_transfer) {
        const filePath = path.join(
          __dirname,
          "public/uploads/bukti/",
          p.bukti_transfer,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    await db.query("DELETE FROM jawaban_peserta WHERE user_id = ?", [id]);
    await db.query("DELETE FROM payments WHERE user_id = ?", [id]);
    await db.query("DELETE FROM users WHERE ID = ?", [id]);

    res.redirect(
      "/dashboardAdmin?message=Akun dan semua file bukti berhasil dibersihkan",
    );
  } catch (error) {
    console.error("Gagal hapus akun & file:", error);
    res.status(500).send("Database error!");
  }
});

app.post("/admin/delete-soal", isAdmin, async (req, res) => {
  const { id, paket } = req.body;
  try {
    await db.query("DELETE FROM questions WHERE id = ?", [id]);
    res.redirect(
      `/admin/kelola-soal/${encodeURIComponent(paket)}?message=Soal berhasil dihapus`,
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal menghapus soal.");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.listen(port, () => {
  console.log(`Server aktif di http://localhost:${port}`);
});
