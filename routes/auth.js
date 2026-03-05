const express = require("express");
const router = express.Router();
const db = require("../config/db");
const rateLimit = require("express-rate-limit");

// Rate limiter login

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const resetDate = new Date(req.rateLimit.resetTime);
    const retryAfter = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
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
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render("register", {
      err: "Terlalu banyak percobaan registrasi. Coba lagi 1 jam lagi.",
    });
  },
});

// GET /login
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { error: null, rateLimited: false, resetTime: null });
});

// POST /login
router.post("/login", loginLimiter, async (req, res) => {
  console.log("IP:", req.ip);
  console.log("Rate limit info:", req.rateLimit);
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0 || password !== rows[0].password) {
      return res.status(401).render("login", {
        error: "Username atau Password salah",
        rateLimited: false,
        resetTime: null,
      });
    }
    const user = rows[0];
    const userRole = user.role.toLowerCase(); // Kita kecilin semua hurufnya

    req.session.user = {
      id: user.id,
      username: user.username,
      role: userRole,
      expired_at: user.expired_at,
      is_active: user.is_active,
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

  if (username.length < 1 || username.length > 20)
    return res.render("register", { err: "Username harus 1-20 karakter!" });

  if (password.length < 6)
    return res.render("register", { err: "Password minimal 6 karakter!" });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.render("register", { err: "Format email tidak valid!" });

  try {
    await db.query(
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'users')",
      [username, password, email],
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
