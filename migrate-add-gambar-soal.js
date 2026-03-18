require("dotenv").config();
const mysql = require("mysql2");

// Ensure to use the correct credentials or connect using the same settings as db.js
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "db_pencatatan", // change if needed
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function migrate() {
  const promisePool = pool.promise();

  console.log("Starting migration to add image columns to the questions table...");

  const queries = [
    "ALTER TABLE questions ADD COLUMN gambar VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE questions ADD COLUMN gambar_a VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE questions ADD COLUMN gambar_b VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE questions ADD COLUMN gambar_c VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE questions ADD COLUMN gambar_d VARCHAR(255) DEFAULT NULL;",
    "ALTER TABLE questions ADD COLUMN gambar_e VARCHAR(255) DEFAULT NULL;",
  ];

  for (const q of queries) {
    try {
      await promisePool.query(q);
      console.log(`Executed: ${q}`);
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log(`Column already exists, skipping: ${q}`);
      } else {
        console.error(`Error on query ${q}:`, err);
      }
    }
  }

  console.log("Migration completed.");
  process.exit(0);
}

migrate();
