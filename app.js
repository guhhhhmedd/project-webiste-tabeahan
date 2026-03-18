require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// SECURITY MIDDLEWARE
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:  ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:   ["'self'", "https://fonts.gstatic.com"],
      imgSrc:    ["'self'", "data:", "https://img.youtube.com", "https://i.ytimg.com"],
      connectSrc:["'self'", "https://cdn.jsdelivr.net"],
    }
  }
}));
// app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());


// GENERAL MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// SESSION
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
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, private, no-store, must-revalidate");
  next();
});

// VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", "views");


// ROUTES
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const adminRouter = require("./routes/admin");
const ujianRouter = require("./routes/ujian");

app.use("/", authRouter);
app.use("/", usersRouter);
app.use("/", adminRouter);
app.use("/ujian", ujianRouter);

// Fungsi helper fallback seperti di users.js
const PAKET_LIST_FALLBACK = [
  { key: "Paket SKD/TKD",       label: "Paket SKD/TKD",       durasi: 90,  deskripsi: null, harga: 50000, harga_asli: 100000 },
  { key: "Paket Akademik Polri", label: "Paket Akademik Polri", durasi: 90,  deskripsi: null, harga: 50000, harga_asli: 100000 },
  { key: "Paket PPPK",           label: "Paket PPPK",           durasi: 120, deskripsi: null, harga: 50000, harga_asli: 100000 },
];

app.get("/", async (req, res) => {
  const db = require("./config/db");
  try {
    const [paketRows] = await db.query("SELECT nama_paket AS `key`, nama_paket AS label, durasi_menit AS durasi, deskripsi, harga, harga_asli FROM paket_ujian ORDER BY id ASC");
    const [tryoutRows] = await db.query("SELECT * FROM paket_to WHERE is_published = 1 ORDER BY paket ASC, nomor_to ASC");
    
    res.render("landing", { 
      paketList: paketRows.length > 0 ? paketRows : PAKET_LIST_FALLBACK,
      tryoutList: tryoutRows 
    });
  } catch (err) {
    console.error("Landing Page Error:", err);
    res.render("landing", { paketList: PAKET_LIST_FALLBACK, tryoutList: [] });
  }
});

app.get("/terms", (req, res) => {
  res.render("terms");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});

// --- AUTO CLEANUP RIWAYAT UJIAN (> 7 HARI) ---
const dbClean = require("./config/db");

async function cleanOldHistory() {
  try {
    const [result] = await dbClean.query(
      "DELETE FROM riwayat_ujian WHERE tgl_selesai < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    if (result && result.affectedRows > 0) {
      console.log(`[CleanUp] Berhasil menghapus ${result.affectedRows} riwayat ujian lama (> 7 hari).`);
    } else {
      console.log("[CleanUp] Tidak ada riwayat ujian lama (> 7 hari) yang dihapus.");
    }
  } catch (err) {
    console.error("[CleanUp] Gagal menghapus riwayat lama:", err);
  }
}

// Jalankan sekali saat boot
cleanOldHistory();

// Jalankan setiap 24 jam sekali
setInterval(cleanOldHistory, 24 * 60 * 60 * 1000);
// --------------------------------------------------

app.listen(port, () => {
  console.log(`Server aktif di http://localhost:${port}`);
});
