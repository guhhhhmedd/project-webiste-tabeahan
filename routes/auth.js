const express = require("express");
const router = express.Router();
const db = require("../config/db");
const rateLimit = require("express-rate-limit");

// Rate limiter login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    res.status(429).render("login", {
      error: null,
      rateLimited: true,
      resetTime: retryAfter,
    });
  },
});

// Rate limiter register
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Terlalu banyak registrasi, coba lagi 1 jam lagi.",
});

// GET /login
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null, rateLimited: false, resetTime: null });
});

// POST /login
router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
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
      error: "Terjadi kesalahan server, coba lagi.",
      rateLimited: false,
      resetTime: null,
    });
  }
});

// GET /register
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("register", { err: null });
});

// POST /register
router.post("/register", registerLimiter, async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email)
    return res.render("register", { err: "Semua form wajib diisi!" });

  if (username.length < 3 || username.length > 20)
    return res.render("register", { err: "Username harus 3-20 karakter!" });

  if (password.length < 6)
    return res.render("register", { err: "Password minimal 6 karakter!" });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.render("register", { err: "Format email tidak valid!" });

  try {
    await db.query(
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'users')",
      [username, password, email]
    );
    res.redirect("/login");
  } catch (err) {
    console.error("ERROR REGISTER:", err);
    let pesanError = "Gagal registrasi.";
    if (err.code === "ER_DUP_ENTRY")
      pesanError = "Username atau Email sudah terdaftar!";
    res.render("register", { err: pesanError });
  }
});

// GET /logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

module.exports = router;
