// =====================================================
// SCRIPT: Hash semua password plaintext yang sudah ada di DB
// Jalankan SEKALI dengan: node migration_bcrypt_passwords.js
// =====================================================

const db     = require("./config/db");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

async function migratePasswords() {
  console.log("Mulai migrasi password...");

  const [users] = await db.query("SELECT id, username, password FROM users");
  let migrated = 0, skipped = 0;

  for (const user of users) {
    // Cek apakah sudah di-hash (bcrypt hash selalu diawali $2b$ atau $2a$)
    if (user.password && user.password.startsWith("$2")) {
      console.log(`  SKIP (sudah hash): ${user.username}`);
      skipped++;
      continue;
    }

    const hashed = await bcrypt.hash(user.password, SALT_ROUNDS);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
    console.log(`  OK: ${user.username} → hash`);
    migrated++;
  }

  console.log(`\nSelesai: ${migrated} di-hash, ${skipped} dilewati.`);
  process.exit(0);
}

migratePasswords().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
