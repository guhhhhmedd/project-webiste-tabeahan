require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// ========================
// SECURITY MIDDLEWARE
// ========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      },
    },
  })
);
app.use(compression());

// ========================
// GENERAL MIDDLEWARE
// ========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// ========================
// SESSION
// ========================
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// No cache — biar reload tidak bisa balik ke halaman sebelumnya
app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, private, no-store, must-revalidate");
  next();
});

// ========================
// VIEW ENGINE
// ========================
app.set("view engine", "ejs");
app.set("views", "views");

// ========================
// ROUTES
// ========================
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const adminRouter = require("./routes/admin");
const ujianRouter = require("./routes/ujian");

app.use("/", authRouter);
app.use("/", usersRouter);
app.use("/", adminRouter);
app.use("/ujian", ujianRouter);

// Landing page
app.get("/", (req, res) => {
  res.render("landing");
});

// ========================
// START SERVER
// ========================
app.listen(port, () => {
  console.log(`Server aktif di http://localhost:${port}`);
});
