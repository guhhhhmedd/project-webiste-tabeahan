require("dotenv").config();
const session = require("express-session");
const express = require("express");
const app = express();
const port = 3000;
const db = require("./config/db"); // db pakai versi PROMISE
const multer = require("multer");
const path = require("path");
const ujianRouter = require("./routes/ujian");

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

// KONFIGURASI MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/bukti/");
  },
  filename: (req, file, cb) => {
    const userId = req.session.user ? req.session.user.id : "anon";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `bukti-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`,
    );
  },
});
const upload = multer({ storage: storage });

// MIDDLEWARE PROTEKSI
function isLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") return next();
  res.status(403).send("Akses Ditolak: Halaman ini khusus Admin.");
}
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
    const [rankingRows] = await db.query(`
      SELECT username, skor 
      FROM users 
      WHERE status_ujian = 'SELESAI' 
      ORDER BY skor DESC, id ASC
    `);

    const myRank =
      rankingRows.findIndex((r) => r.username === user.username) + 1;

    res.render("users/dashboard", {
      user: user,
      rankings: rankingRows.slice(0, 10),
      myRank: myRank > 0 ? myRank : "-",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database Error");
  }
});

app.get("/dashboardAdmin", isLogin, isAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT users.id, users.username, users.email, users.token_ujian, 
             payments.bukti_transfer, users.status 
      FROM users 
      LEFT JOIN payments ON users.id = payments.user_id 
      WHERE users.role = 'users'
    `;
    const [results] = await db.query(sql);
    res.render("admin/dashboardAdmin", { users: results });
  } catch (err) {
    res.status(500).send("Database Error Admin");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0 || password !== rows[0].password) {
      return res.render("login", { error: "Username atau Password salah" });
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
    res.render("login", { error: "Terjadi kesalahan server: " + err.message });
  }
});

app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.render("register", { error: "Semua form wajib diisi, Bre!" });
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

    res.render("register", { error: pesanError });
  }
});

app.post(
  "/users/upload-bukti",
  isLogin,
  upload.single("bukti"),
  async (req, res) => {
    if (!req.file) return res.status(400).send("Mohon pilih file.");
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
      res.status(500).send("Gagal upload.");
    }
  },
);

app.get("/admin/verify/:id", isLogin, isAdmin, async (req, res) => {
  const targetId = req.params.id; // Ini ID orang yang mau diverifikasi

  try {
    const tokenBaru = Math.random().toString(36).substring(2, 10).toUpperCase();

    // 1. Update status di tabel USERS dulu
    await db.query(
      "UPDATE users SET status = 'LUNAS', token_ujian = ? WHERE id = ?",
      [tokenBaru, targetId],
    );

    // 2. Update status di tabel PAYMENTS
    // Pastikan targetId ini sama dengan kolom user_id di tabel payments
    const [result] = await db.query(
      "UPDATE payments SET status = 'LUNAS' WHERE user_id = ?",
      [targetId],
    );

    console.log(
      `Update payment untuk User ${targetId} berhasil. Baris terpengaruh: ${result.affectedRows}`,
    );

    // 3. Kalau semua sukses, baru redirect
    res.redirect("/dashboardAdmin");
  } catch (err) {
    console.error("ERROR VERIFIKASI:", err);
    // Biar nggak BLANK PAGE, kasih respon yang jelas
    res.status(500).send(`
            <h3>Gagal Verifikasi Le!</h3>
            <p>Pesan Error: ${err.message}</p>
            <a href="/dashboardAdmin">Kembali ke Dashboard</a>
        `);
  }
});

// delete account

app.post("/deleteAccount", isLogin, async (req, res) => {
  const { id } = req.body;

  try {
    await db.query("DELETE FROM users WHERE ID = ? ", [id]);
    req.session.destroy((err) => {
      if (err) {
        console.error("Gagal hapus session:", err);
        return res.redirect("/dashboard");
      }
      res.clearCookie("connect.sid");
      res.render("register", {
        message: "Akun anda berhasil dihapus selamanya.",
      });
    });
  } catch (error) {
    console.error("hapus akun");
    res.render("dashboard", { error: "akun anda gagal dihapus" });
  }
});

// app.get("/deleteAccount", (req, res) => {
//   req.session.destroy(() => {
//     res.render("register", { erorr: null });
//   });
// });

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.listen(port, () => {
  console.log(`Server aktif di http://localhost:${port}`);
});
