const express   = require("express");
const router    = express.Router();
const db        = require("../config/db");
const rateLimit = require("express-rate-limit");
const bcrypt    = require("bcrypt");

const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────
// RATE LIMITER — Login
// ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const resetDate  = new Date(req.rateLimit.resetTime);
    const retryAfter = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
    res.status(429).render("login", {
      error: null,
      rateLimited: true,
      resetTime: retryAfter,
    });
  },
});

// ─────────────────────────────────────────────
// RATE LIMITER — Register
// ─────────────────────────────────────────────
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render("register", {
      err: "Terlalu banyak percobaan registrasi. Coba lagi 1 jam lagi.",
    });
  },
});

// ─────────────────────────────────────────────
// HELPER — Cek & sync status anggota offline
// Dipanggil saat register dan login
// ─────────────────────────────────────────────
async function syncStatusAnggota(userId, email) {
  const [anggota] = await db.query(
    "SELECT id FROM anggota_offline WHERE LOWER(email) = LOWER(?)",
    [email]
  );
  if (anggota.length > 0) {
    await Promise.all([
      db.query(
        "UPDATE users SET is_anggota = 1 WHERE id = ?",
        [userId]
      ),
      db.query(
        "UPDATE anggota_offline SET user_id = ? WHERE LOWER(email) = LOWER(?)",
        [userId, email]
      ),
    ]);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// GET /login
// ─────────────────────────────────────────────
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null, rateLimited: false, resetTime: null });
});

// ─────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).render("login", {
        error: "Username atau Password salah",
        rateLimited: false,
        resetTime: null,
      });
    }

    const passwordMatch = await bcrypt.compare(password, rows[0].password);
    if (!passwordMatch) {
      return res.status(401).render("login", {
        error: "Username atau Password salah",
        rateLimited: false,
        resetTime: null,
      });
    }

    const user     = rows[0];
    const userRole = user.role.toLowerCase();

    // Sync status anggota setiap login
    // (handle kasus: email didaftarkan admin SETELAH user sudah register)
    await syncStatusAnggota(user.id, user.email);

    // Ambil ulang supaya is_anggota selalu fresh
    const [fresh] = await db.query(
      "SELECT is_anggota, status_ujian FROM users WHERE id = ?",
      [user.id]
    );

    req.session.user = {
      id:           user.id,
      username:     user.username,
      email:        user.email,
      role:         userRole,
      expired_at:   user.expired_at,
      is_active:    user.is_active,
      is_anggota:   fresh[0].is_anggota,   // ← kunci fitur gratis
      status_ujian: fresh[0].status_ujian,
    };

    req.session.save(() => {
      if (userRole === "admin") {
        res.redirect("/dashboardAdmin");
      } else {
        res.redirect("/dashboard");
      }
    });
  } catch (err) {
    console.error("ERROR LOGIN:", err);
    res.render("login", {
      error: "Terjadi kesalahan server, coba lagi.",
      rateLimited: false,
      resetTime: null,
    });
  }
});

// ─────────────────────────────────────────────
// GET /register
// ─────────────────────────────────────────────
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("register", { err: null });
});

// ─────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────
router.post("/register", registerLimiter, async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email)
    return res.render("register", { err: "Semua form wajib diisi!" });

  if (username.length < 1 || username.length > 20)
    return res.render("register", { err: "Username harus 1-20 karakter!" });

  if (password.length < 6)
    return res.render("register", { err: "Password minimal 6 karakter!" });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.render("register", { err: "Format email tidak valid!" });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query(
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'users')",
      [username, hashedPassword, email]
    );

    // Cek apakah email ada di whitelist anggota offline
    // Kalau ada → langsung set is_anggota = 1 tanpa perlu login ulang
    await syncStatusAnggota(result.insertId, email);

    res.redirect("/login?success=" + encodeURIComponent(
      "Registrasi berhasil! Silakan login."
    ));
  } catch (err) {
    console.error("ERROR REGISTER:", err);
    let pesanError = "Gagal registrasi.";
    if (err.code === "ER_DUP_ENTRY")
      pesanError = "Username atau Email sudah terdaftar!";
    res.render("register", { err: pesanError });
  }
});

// ─────────────────────────────────────────────
// GET /logout
// ─────────────────────────────────────────────
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

module.exports = router;
