/**
 * Migrasi v2: Perbaikan tabel jawaban_peserta
 * Mengecek INFORMATION_SCHEMA sebelum ALTER agar tidak salah tangkap error.
 * Jalankan: node migrate-fix-jawaban-v2.js
 */
const db = require('./config/db');

async function kolumAda(tabel, kolom) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
    [tabel, kolom]
  );
  return rows[0].cnt > 0;
}

async function indexAda(tabel, namaIndex) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND INDEX_NAME   = ?`,
    [tabel, namaIndex]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  try {
    console.log('⏳ Memeriksa dan memperbarui tabel jawaban_peserta...\n');

    // 1. Tambah kolom paket
    if (await kolumAda('jawaban_peserta', 'paket')) {
      console.log('  ✓ Kolom paket   → sudah ada');
    } else {
      await db.query(`ALTER TABLE jawaban_peserta ADD COLUMN paket VARCHAR(100) DEFAULT NULL AFTER user_id`);
      console.log('  ✅ Kolom paket   → DITAMBAHKAN');
    }

    // 2. Tambah kolom nomor_to
    if (await kolumAda('jawaban_peserta', 'nomor_to')) {
      console.log('  ✓ Kolom nomor_to → sudah ada');
    } else {
      await db.query(`ALTER TABLE jawaban_peserta ADD COLUMN nomor_to INT DEFAULT 1 AFTER paket`);
      console.log('  ✅ Kolom nomor_to → DITAMBAHKAN');
    }

    // 3. Hapus unique key lama (user_id, question_id) jika masih ada
    if (await indexAda('jawaban_peserta', 'user_id')) {
      await db.query(`ALTER TABLE jawaban_peserta DROP INDEX user_id`);
      console.log('  ✅ UNIQUE KEY lama (user_id) → DIHAPUS');
    } else {
      console.log('  ✓ UNIQUE KEY lama → tidak ada / sudah dihapus');
    }

    // 4. Buat unique key baru yang menyertakan paket + nomor_to
    if (await indexAda('jawaban_peserta', 'unique_jawaban_sesi')) {
      console.log('  ✓ UNIQUE KEY unique_jawaban_sesi → sudah ada');
    } else {
      await db.query(`
        ALTER TABLE jawaban_peserta
          ADD UNIQUE KEY unique_jawaban_sesi (user_id, paket, nomor_to, question_id)
      `);
      console.log('  ✅ UNIQUE KEY unique_jawaban_sesi → DIBUAT');
    }

    // 5. Index untuk performa query review
    if (await indexAda('jawaban_peserta', 'idx_jawaban_sesi')) {
      console.log('  ✓ INDEX idx_jawaban_sesi → sudah ada');
    } else {
      await db.query(`
        ALTER TABLE jawaban_peserta
          ADD INDEX idx_jawaban_sesi (user_id, paket, nomor_to)
      `);
      console.log('  ✅ INDEX idx_jawaban_sesi → DIBUAT');
    }

    console.log('\n✅ Migrasi jawaban_peserta selesai!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Gagal migrasi:', err.message);
    console.error(err);
    process.exit(1);
  }
}

migrate();
